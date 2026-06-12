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

  const model = firstMatch(text, [
    /(?:model(?: is|:)?|it is an?|it's an?)\s+([A-Za-z0-9][A-Za-z0-9._\/-]{2,30})(?=\s+(?:on|with|and|but)\b|[.,;]|$)/i,
    /(?:receiver|projector|tv|television|processor|amplifier|speaker|device)\s+(?:is\s+)?([A-Za-z0-9][A-Za-z0-9._\/-]{2,30})/i
  ]);
  if (model) facts.model = model;

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
    ['no_video', /no picture|no video|black screen/],
    ['intermittent', /intermittent|cuts out|drops out|sometimes works/],
    ['not_detected', /not detected|not recognized|unknown device/],
    ['error_message', /error code|error message|driver error/],
    ['distortion', /distort|buzz|hum|crackle/]
  ];
  for (const [name, pattern] of symptomMap) if (pattern.test(lower)) symptoms.push(name);
  if (symptoms.length) facts.symptoms = [...new Set([...(facts.symptoms || []), ...symptoms])];

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
      version: 'ava_diagnostic_state_v1_0_0',
      stage: intent === 'system_design' ? 'experience_definition' : 'use_case_definition',
      known_facts: facts,
      missing_fields: [],
      next_question: plan.first_question,
      branch: intent
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
    version: 'ava_diagnostic_state_v1_0_0',
    stage,
    branch: domains.includes('driver_or_firmware') ? 'driver_or_firmware' : domains[0] || 'general_troubleshooting',
    known_facts: facts,
    missing_fields: missing,
    next_question: nextQuestion
  };
}

export function buildDeterministicAvCandidate({ plan, diagnosticState, facts }) {
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
    return `A strong home theater begins with the experience and the room, not a shopping list. Picture, sound, seating, lighting, control, appearance, and serviceability should be designed as one system. ${diagnosticState.next_question || plan.first_question}`;
  }

  return null;
}
