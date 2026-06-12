const DRIVER_TERMS = [
  'driver',
  'firmware',
  'software update',
  'device manager',
  'usb'
];

const HDMI_LINK_TERMS = [
  'hdmi',
  'edid',
  'hdcp',
  'handshake',
  'black screen',
  'no signal',
  'hdr',
  'dolby vision',
  'refresh rate',
  'bandwidth'
];

const AUDIO_TERMS = [
  'audio', 'speaker', 'receiver', 'avr', 'amplifier', 'subwoofer',
  'sound', 'dolby', 'dts', 'arc', 'earc'
];

const VIDEO_TERMS = [
  'video', 'display', 'television', 'tv', 'projector', 'screen',
  'picture', 'resolution', 'hdr', 'hdmi', 'edid', 'hdcp', 'black screen'
];

const CONTROL_TERMS = [
  'control', 'remote', 'automation', 'crestron', 'control4', 'urc',
  'savant', 'rs-232', 'ip control'
];

const TROUBLE_TERMS = [
  'not working', 'issue', 'problem', 'trouble', 'error', 'driver',
  'black screen', 'no signal', 'drops', 'dropout', 'drops out', 'cuts out',
  'intermittent', 'fails', 'failure', 'handshake', 'not detected',
  'not recognized', 'flicker', 'loses', 'loss of', 'disconnects'
];

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function classifyIntent(message = '', priorContext = '') {
  const text = `${String(priorContext)} ${String(message)}`.toLowerCase();

  if (includesAny(text, TROUBLE_TERMS)) return 'troubleshooting';

  if (includesAny(text, ['design', 'plan', 'build', 'home theater', 'cinema'])) {
    return 'system_design';
  }

  if (includesAny(text, ['recommend', 'which', 'best', 'buy'])) {
    return 'equipment_guidance';
  }

  return 'general_av_guidance';
}

function classifyDomain(message = '', priorContext = '') {
  const text = `${String(priorContext)} ${String(message)}`.toLowerCase();
  const matches = [];

  if (includesAny(text, DRIVER_TERMS)) matches.push('driver_or_firmware');
  if (includesAny(text, HDMI_LINK_TERMS)) matches.push('hdmi_signal_path');
  if (includesAny(text, AUDIO_TERMS)) matches.push('audio');
  if (includesAny(text, VIDEO_TERMS)) matches.push('video');
  if (includesAny(text, CONTROL_TERMS)) matches.push('control');

  return [...new Set(matches.length ? matches : ['undetermined_av_domain'])];
}

function diagnosticPriority(intent, domains) {
  if (intent === 'troubleshooting') {
    if (domains.includes('hdmi_signal_path')) {
      return [
        'Map the complete source-to-receiver-to-display signal path.',
        'Identify the exact models, HDMI inputs/outputs, cable lengths, and signal mode that triggers the failure.',
        'Separate EDID capability negotiation from HDCP authentication and raw HDMI bandwidth or cable integrity.',
        'Reproduce the fault with the simplest direct connection, then reinsert the receiver.',
        'Change one variable at a time: resolution, refresh rate, HDR format, chroma, deep color, HDCP mode, or cable path.'
      ];
    }

    if (domains.includes('driver_or_firmware')) {
      return [
        'Identify the exact manufacturer and model.',
        'Identify the device receiving the driver or firmware.',
        'Determine the operating system or control platform.',
        'Determine what changed immediately before the failure.',
        'Separate driver failure from cable, handshake, network, or hardware failure.'
      ];
    }

    return [
      'Identify the exact affected component.',
      'Determine the signal path from source to destination.',
      'Establish whether the failure is constant or intermittent.',
      'Determine what changed before the problem began.',
      'Isolate power, connection, configuration, firmware, and hardware causes.'
    ];
  }

  if (intent === 'system_design') {
    return [
      'Establish the intended experience and room function.',
      'Determine room dimensions and seating geometry.',
      'Identify display, audio, lighting, control, and aesthetic priorities.',
      'Determine installation constraints and investment level.',
      'Build the system as one coordinated design rather than a parts list.'
    ];
  }

  return [
    'Understand the actual use case.',
    'Identify existing equipment and constraints.',
    'Clarify the desired improvement.',
    'Avoid recommendations until compatibility is established.'
  ];
}

function firstQuestion(intent, domains) {
  if (intent === 'troubleshooting' && domains.includes('hdmi_signal_path')) {
    return 'What are the exact source, receiver, and display models, which HDMI ports are in use, and which signal change—such as HDR, 4K/120, Dolby Vision, or a refresh-rate switch—causes the screen to drop?';
  }

  if (intent === 'troubleshooting' && domains.includes('driver_or_firmware')) {
    return 'What is the exact manufacturer and model of the affected device, and what computer, operating system, processor, receiver, or control platform is supposed to communicate with it?';
  }

  if (intent === 'troubleshooting') {
    return 'What is the exact model of the component that is failing, and what source and destination devices are connected on either side of it?';
  }

  if (intent === 'system_design') {
    return 'Will this be a dedicated cinema, or must the room also serve everyday television, music, gaming, or family use?';
  }

  return 'What exact equipment is involved, and what result are you trying to achieve?';
}

export function buildAvAiPlan(message = '', context = {}) {
  const text = String(message || '').trim();
  const priorContext = [
    ...(context.turns || []).map((turn) => turn.text || ''),
    JSON.stringify(context.facts || {})
  ].join(' ');
  const intent = classifyIntent(text, priorContext);
  const domains = classifyDomain(text, priorContext);

  return {
    planner_version: 'ava_av_ai_planner_v1_1_0',
    intent,
    domains,
    diagnostic_priority: diagnosticPriority(intent, domains),
    first_question: firstQuestion(intent, domains),
    response_rules: [
      'Demonstrate useful AV reasoning before asking a question.',
      'Do not merely ask for more context.',
      'Do not present a large intake checklist.',
      'Ask one high-value next question.',
      'Use prior session facts and do not ask again for equipment already provided.',
      'For HDMI faults, separate EDID negotiation, HDCP authentication, bandwidth/cable integrity, port configuration, and firmware.',
      'Do not recommend replacement equipment until the failure domain is isolated.'
    ]
  };
}
