function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim().slice(0, 120);
  }
  return null;
}

export function extractAvFacts(message = '', priorFacts = {}) {
  const text = String(message || '');
  const lower = text.toLowerCase();
  const facts = { ...priorFacts };

  const equipmentPatterns = [
    ['receiver', /(?:receiver|avr)\s+(?:is\s+)?(?:an?\s+)?(.+?)(?=,\s|\s+and\b|\.|$)/i],
    ['display', /(?:television|tv|display|projector)\s+(?:is\s+)?(?:an?\s+)?(.+?)(?=,\s|\s+and\b|\.|$)/i],
    ['source', /(?:source|player|console)\s+(?:is\s+)?(?:an?\s+)?(.+?)(?=,\s|\s+and\b|\.|$)/i]
  ];
  facts.equipment = { ...(facts.equipment || {}) };
  for (const [role, pattern] of equipmentPatterns) {
    const value = firstMatch(text, [pattern]);
    if (value) facts.equipment[role] = value;
  }
  if (Object.keys(facts.equipment).length === 0) delete facts.equipment;

  const genericModel = firstMatch(text, [
    /(?:model(?: is|:)?|it is an?|it's an?)\s+([A-Za-z0-9][A-Za-z0-9._\/-]{2,30})(?=\s+(?:on|with|and|but)\b|[.,;]|$)/i
  ]);
  if (genericModel) facts.model = genericModel;

  const manufacturer = firstMatch(text, [
    /(?:manufacturer|brand|made by)(?: is|:)?\s+([A-Za-z][A-Za-z0-9 &.-]{1,30})/i
  ]);
  if (manufacturer) facts.manufacturer = manufacturer;

  const os = firstMatch(text, [
    /\b(Windows 11|Windows 10|macOS(?: [A-Za-z0-9.]+)?|iOS(?: [0-9.]+)?|Android(?: [0-9.]+)?|Linux)\b/i
  ]);
  if (os) facts.operating_system = os;

  const symptoms = [];
  const symptomMap = [
    ['no_audio', /no sound|no audio|silent/],
    ['no_video', /no picture|no video|black screen|no signal/],
    ['intermittent', /intermittent|cuts out|drops out|screen drops|sometimes works|flicker/],
    ['not_detected', /not detected|not recognized|unknown device/],
    ['error_message', /error code|error message|driver error/],
    ['distortion', /distort|buzz|hum|crackle/],
    ['hdr_transition_failure', /when switching into hdr|switching to hdr|hdr.*(?:drops|black|fails)|(?:drops|black|fails).*hdr/]
  ];
  for (const [name, pattern] of symptomMap) if (pattern.test(lower)) symptoms.push(name);
  if (symptoms.length) facts.symptoms = [...new Set([...(facts.symptoms || []), ...symptoms])];

  if (/hdr/.test(lower)) facts.signal_mode = 'HDR';
  if (/4k\s*120|4k\/120|120\s*hz/.test(lower)) facts.signal_mode = '4K120';
  if (/dolby vision/.test(lower)) facts.signal_mode = 'Dolby Vision';

  if (/after (?:an )?update|updated|new firmware|new driver|changed cable|moved|power outage/.test(lower)) {
    facts.recent_change = text.slice(0, 220);
  }

  return facts;
}

export function buildDiagnosticState(plan = {}, facts = {}) {
  const domains = plan.domains || [];
  const intent = plan.intent || 'general_av_guidance';

  if (intent !== 'troubleshooting') {
    return {
      version: 'ava_diagnostic_state_v1_1_0',
      stage: intent === 'system_design' ? 'experience_definition' : 'use_case_definition',
      known_facts: facts,
      missing_fields: [],
      next_question: plan.first_question,
      branch: intent
    };
  }

  if (domains.includes('hdmi_signal_path')) {
    const equipment = facts.equipment || {};
    const missing = ['source', 'receiver', 'display'].filter((key) => !equipment[key]);
    let stage = 'identify_signal_path';
    let nextQuestion = plan.first_question;

    if (missing.length === 0 && !facts.symptoms?.length) {
      stage = 'identify_trigger';
      nextQuestion = 'What exact signal change triggers the loss—HDR, Dolby Vision, 4K/120, a refresh-rate switch, or protected-content playback?';
    } else if (missing.length === 0 && facts.symptoms?.length) {
      stage = 'direct_path_isolation';
      nextQuestion = 'Does the same HDR dropout occur when the source is connected directly to the television with the same HDMI cable and the receiver temporarily removed from the video path?';
    }

    return {
      version: 'ava_diagnostic_state_v1_1_0',
      stage,
      branch: 'hdmi_signal_path',
      known_facts: facts,
      missing_fields: missing,
      next_question: nextQuestion
    };
  }

  const required = ['manufacturer', 'model'];
  if (domains.includes('driver_or_firmware')) required.push('platform');
  const missing = required.filter((key) => {
    if (key === 'platform') return !facts.operating_system && !facts.control_platform && !facts.connected_platform;
    return !facts[key];
  });

  let stage = 'identify_equipment';
  let nextQuestion = plan.first_question;

  if (missing.length === 0 && !facts.symptoms?.length) {
    stage = 'identify_symptom';
    nextQuestion = 'What exactly happens when the problem occurs—does the device disappear, fail to communicate, lose audio or video, show an error, or work intermittently?';
  } else if (missing.length === 0 && facts.symptoms?.length && !facts.recent_change) {
    stage = 'identify_recent_change';
    nextQuestion = 'What changed immediately before the problem began—an operating-system update, firmware update, cable change, control-program change, power event, or equipment move?';
  } else if (missing.length === 0) {
    stage = 'isolate_failure_domain';
    nextQuestion = 'Does the device behave correctly when connected by the simplest direct path, with control processors, adapters, extenders, and automation temporarily removed?';
  }

  return {
    version: 'ava_diagnostic_state_v1_1_0',
    stage,
    branch: domains.includes('driver_or_firmware') ? 'driver_or_firmware' : domains[0] || 'general_troubleshooting',
    known_facts: facts,
    missing_fields: missing,
    next_question: nextQuestion
  };
}

export function buildDeterministicAvCandidate({ plan, diagnosticState, facts }) {
  if (plan.intent === 'troubleshooting' && plan.domains.includes('hdmi_signal_path')) {
    if (diagnosticState.stage === 'identify_signal_path') {
      return `An intermittent black screen in a source-to-receiver-to-display chain is usually isolated in this order: confirm the complete signal path and exact models, reproduce the failure at the triggering format, test the source directly into the display, then reinsert the receiver and change one HDMI variable at a time. EDID determines which formats the source believes the chain supports; HDCP separately authenticates protected playback; cable bandwidth, port mode, and firmware can fail at the moment HDR or a higher-bandwidth format starts. ${diagnosticState.next_question}`;
    }
    if (diagnosticState.stage === 'direct_path_isolation') {
      const e = facts.equipment || {};
      return `With ${e.source || 'the source'}, ${e.receiver || 'the receiver'}, and ${e.display || 'the display'} identified, the HDR transition is the decisive clue. First test the source directly into the display using the same cable and HDR mode. If the dropout disappears, the receiver path—its HDMI input/output mode, EDID handling, HDCP session, firmware, or the second cable—is implicated. If it remains, focus on the source output, display input mode, and cable bandwidth. ${diagnosticState.next_question}`;
    }
  }
  if (plan.intent === 'troubleshooting' && plan.domains.includes('driver_or_firmware')) {
    if (diagnosticState.stage === 'identify_equipment') {
      return `“Driver issue” can describe several different failures in an AV system: a software driver, firmware, a control-system driver, a loudspeaker driver, or a signal-path problem that only appears to be software-related. The correct first move is to identify the exact device and platform before changing or replacing anything. ${diagnosticState.next_question}`;
    }
    if (diagnosticState.stage === 'identify_symptom') {
      return `We now have enough equipment context to stop treating this as a generic driver problem. The next step is to identify the failure behavior, because a device that disappears from the operating system points in a different direction than one that remains detected but loses audio, video, or control. ${diagnosticState.next_question}`;
    }
    if (diagnosticState.stage === 'identify_recent_change') {
      return `The equipment and symptom are identified, so the most useful divider is what changed just before the failure. That separates update-related driver or firmware faults from cable, power, configuration, and hardware causes. ${diagnosticState.next_question}`;
    }
    return `The known facts now support an isolation test rather than more general questioning. A direct-path test can separate the device and its driver or firmware from control processors, extenders, adapters, cabling, and automation layers. ${diagnosticState.next_question}`;
  }

  if (plan.intent === 'system_design') {
    const equipment = facts.equipment || {};
    const known = [
      equipment.display ? `display: ${equipment.display}` : null,
      equipment.audio ? `audio: ${equipment.audio}` : null,
      equipment.source ? `source: ${equipment.source}` : null
    ].filter(Boolean).join(', ');

    return `A proper living-room theater begins with the room's role, not with a shopping list. The TV, soundbar, and game console should be treated as one experience: sightlines and seating first, then screen position, audio clarity, cable path, lighting control, day-to-day ease, and whether the room should feel like a cinema or remain a relaxed family space. ${known ? `Known equipment: ${known}. ` : ''}${diagnosticState.next_question || plan.first_question}`;
  }

  return null;
}
