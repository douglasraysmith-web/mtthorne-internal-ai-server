const DRIVER_TERMS = [
  'driver',
  'firmware',
  'software update',
  'device manager',
  'usb',
  'hdmi handshake',
  'edid',
  'hdcp'
];

const AUDIO_TERMS = [
  'audio',
  'speaker',
  'receiver',
  'avr',
  'amplifier',
  'subwoofer',
  'sound',
  'dolby',
  'dts',
  'arc',
  'earc'
];

const VIDEO_TERMS = [
  'video',
  'display',
  'television',
  'tv',
  'projector',
  'screen',
  'picture',
  'resolution',
  'hdr',
  'hdmi'
];

const CONTROL_TERMS = [
  'control',
  'remote',
  'automation',
  'crestron',
  'control4',
  'urc',
  'savant',
  'ir',
  'rs-232',
  'ip control'
];

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function classifyIntent(message = '') {
  const text = String(message).toLowerCase();

  if (
    text.includes('not working') ||
    text.includes('issue') ||
    text.includes('problem') ||
    text.includes('trouble') ||
    text.includes('error') ||
    text.includes('driver')
  ) {
    return 'troubleshooting';
  }

  if (
    text.includes('design') ||
    text.includes('plan') ||
    text.includes('build') ||
    text.includes('home theater') ||
    text.includes('cinema')
  ) {
    return 'system_design';
  }

  if (
    text.includes('recommend') ||
    text.includes('which') ||
    text.includes('best') ||
    text.includes('buy')
  ) {
    return 'equipment_guidance';
  }

  return 'general_av_guidance';
}

function classifyDomain(message = '') {
  const text = String(message).toLowerCase();

  const matches = [];

  if (includesAny(text, DRIVER_TERMS)) matches.push('driver_or_firmware');
  if (includesAny(text, AUDIO_TERMS)) matches.push('audio');
  if (includesAny(text, VIDEO_TERMS)) matches.push('video');
  if (includesAny(text, CONTROL_TERMS)) matches.push('control');

  return matches.length ? matches : ['undetermined_av_domain'];
}

function diagnosticPriority(intent, domains) {
  if (intent === 'troubleshooting') {
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
  if (
    intent === 'troubleshooting' &&
    domains.includes('driver_or_firmware')
  ) {
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

export function buildAvAiPlan(message = {}) {
  const text = String(message || '').trim();
  const intent = classifyIntent(text);
  const domains = classifyDomain(text);

  return {
    planner_version: 'ava_av_ai_planner_v1_0_0',
    intent,
    domains,
    diagnostic_priority: diagnosticPriority(intent, domains),
    first_question: firstQuestion(intent, domains),
    response_rules: [
      'Demonstrate useful AV reasoning before asking a question.',
      'Do not merely ask for more context.',
      'Do not present a large intake checklist.',
      'Ask one high-value next question.',
      'Do not assume the word driver means only a computer driver.',
      'Distinguish software driver, firmware, loudspeaker driver, control driver, and signal-path failure.',
      'Do not recommend replacement equipment until the failure domain is isolated.'
    ]
  };
}
