import {
  NodeCategory,
  DataType,
  type NodeDefinition,
} from '@/types/node.types';

export const NODE_REGISTRY: Record<string, NodeDefinition> = {
  scriptInput: {
    type: 'scriptInput',
    label: 'Script Input',
    category: NodeCategory.INPUT,
    icon: 'FileText',
    description: 'Provide a script or screenplay as input text',
    defaultData: {
      config: { content: '', format: 'plaintext' },
    },
    inputs: [],
    outputs: [
      {
        id: 'script',
        label: 'Script',
        dataType: DataType.SCRIPT,
        isRequired: false,
        maxConnections: 5,
      },
    ],
    configFields: [
      {
        key: 'content',
        label: 'Script Content',
        type: 'textarea',
        defaultValue: '',
        placeholder: 'Paste your script here...',
      },
      {
        key: 'format',
        label: 'Format',
        type: 'select',
        defaultValue: 'plaintext',
        options: [
          { label: 'Plain Text', value: 'plaintext' },
          { label: 'Screenplay', value: 'screenplay' },
          { label: 'Markdown', value: 'markdown' },
        ],
      },
    ],
    supportedProviders: [],
  },

  scriptAnalyzer: {
    type: 'scriptAnalyzer',
    label: 'Script Analyzer',
    category: NodeCategory.PROCESSING,
    icon: 'Search',
    description: 'Analyze script for structure, tone, and key elements',
    defaultData: {
      config: { analysisDepth: 'standard', extractDialogue: true },
    },
    inputs: [
      {
        id: 'script',
        label: 'Script',
        dataType: DataType.SCRIPT,
        isRequired: true,
        maxConnections: 1,
      },
    ],
    outputs: [
      {
        id: 'script',
        label: 'Analyzed Script',
        dataType: DataType.SCRIPT,
        isRequired: false,
        maxConnections: 5,
      },
      {
        id: 'characters',
        label: 'Characters',
        dataType: DataType.CHARACTERS,
        isRequired: false,
        maxConnections: 5,
      },
    ],
    configFields: [
      {
        key: 'analysisDepth',
        label: 'Analysis Depth',
        type: 'select',
        defaultValue: 'standard',
        options: [
          { label: 'Quick', value: 'quick' },
          { label: 'Standard', value: 'standard' },
          { label: 'Detailed', value: 'detailed' },
        ],
      },
      {
        key: 'extractDialogue',
        label: 'Extract Dialogue',
        type: 'toggle',
        defaultValue: true,
      },
    ],
    supportedProviders: ['openai', 'anthropic', 'google'],
  },

  characterExtractor: {
    type: 'characterExtractor',
    label: 'Character Extractor',
    category: NodeCategory.PROCESSING,
    icon: 'Users',
    description: 'Extract and describe characters from the script',
    defaultData: {
      config: { includeAppearance: true, includePersonality: true },
    },
    inputs: [
      {
        id: 'script',
        label: 'Script',
        dataType: DataType.SCRIPT,
        isRequired: true,
        maxConnections: 1,
      },
    ],
    outputs: [
      {
        id: 'characters',
        label: 'Characters',
        dataType: DataType.CHARACTERS,
        isRequired: false,
        maxConnections: 5,
      },
      {
        id: 'script',
        label: 'Script',
        dataType: DataType.SCRIPT,
        isRequired: false,
        maxConnections: 5,
      },
    ],
    configFields: [
      {
        key: 'includeAppearance',
        label: 'Include Appearance',
        type: 'toggle',
        defaultValue: true,
      },
      {
        key: 'includePersonality',
        label: 'Include Personality',
        type: 'toggle',
        defaultValue: true,
      },
    ],
    supportedProviders: ['openai', 'anthropic', 'google'],
  },

  sceneSplitter: {
    type: 'sceneSplitter',
    label: 'Scene Splitter',
    category: NodeCategory.PROCESSING,
    icon: 'Scissors',
    description: 'Split script into individual scenes',
    defaultData: {
      config: { maxScenesPerChunk: 5, preserveTransitions: true },
    },
    inputs: [
      {
        id: 'script',
        label: 'Script',
        dataType: DataType.SCRIPT,
        isRequired: true,
        maxConnections: 1,
      },
      {
        id: 'characters',
        label: 'Characters',
        dataType: DataType.CHARACTERS,
        isRequired: false,
        maxConnections: 1,
      },
    ],
    outputs: [
      {
        id: 'scenes',
        label: 'Scenes',
        dataType: DataType.SCENES,
        isRequired: false,
        maxConnections: 5,
      },
    ],
    configFields: [
      {
        key: 'maxScenesPerChunk',
        label: 'Max Scenes per Chunk',
        type: 'number',
        defaultValue: 5,
        min: 1,
        max: 20,
      },
      {
        key: 'preserveTransitions',
        label: 'Preserve Transitions',
        type: 'toggle',
        defaultValue: true,
      },
    ],
    supportedProviders: ['openai', 'anthropic'],
  },

  imageGenerator: {
    type: 'imageGenerator',
    label: 'Image Generator',
    category: NodeCategory.GENERATION,
    icon: 'Image',
    description: 'Generate images from scene descriptions',
    defaultData: {
      config: {
        style: 'cinematic',
        aspectRatio: '16:9',
        quality: 'high',
      },
    },
    inputs: [
      {
        id: 'scenes',
        label: 'Scenes',
        dataType: DataType.SCENES,
        isRequired: true,
        maxConnections: 1,
      },
      {
        id: 'characters',
        label: 'Characters',
        dataType: DataType.CHARACTERS,
        isRequired: false,
        maxConnections: 1,
      },
    ],
    outputs: [
      {
        id: 'images',
        label: 'Images',
        dataType: DataType.IMAGE,
        isRequired: false,
        maxConnections: 5,
      },
    ],
    configFields: [
      {
        key: 'style',
        label: 'Visual Style',
        type: 'select',
        defaultValue: 'cinematic',
        options: [
          { label: 'Cinematic', value: 'cinematic' },
          { label: 'Anime', value: 'anime' },
          { label: 'Photorealistic', value: 'photorealistic' },
          { label: 'Illustration', value: 'illustration' },
          { label: 'Watercolor', value: 'watercolor' },
        ],
      },
      {
        key: 'aspectRatio',
        label: 'Aspect Ratio',
        type: 'select',
        defaultValue: '16:9',
        options: [
          { label: '16:9', value: '16:9' },
          { label: '9:16', value: '9:16' },
          { label: '1:1', value: '1:1' },
          { label: '4:3', value: '4:3' },
        ],
      },
      {
        key: 'quality',
        label: 'Quality',
        type: 'select',
        defaultValue: 'high',
        options: [
          { label: 'Draft', value: 'draft' },
          { label: 'Standard', value: 'standard' },
          { label: 'High', value: 'high' },
        ],
      },
    ],
    supportedProviders: ['openai', 'stability', 'midjourney'],
  },

  frameComposer: {
    type: 'frameComposer',
    label: 'Frame Composer',
    category: NodeCategory.GENERATION,
    icon: 'Layers',
    description: 'Compose frames with camera movement and effects',
    defaultData: {
      config: { cameraMotion: 'pan', transitionType: 'dissolve', fps: 24 },
    },
    inputs: [
      {
        id: 'images',
        label: 'Images',
        dataType: DataType.IMAGE,
        isRequired: true,
        maxConnections: 1,
      },
      {
        id: 'scenes',
        label: 'Scenes',
        dataType: DataType.SCENES,
        isRequired: false,
        maxConnections: 1,
      },
    ],
    outputs: [
      {
        id: 'frames',
        label: 'Frames',
        dataType: DataType.FRAME,
        isRequired: false,
        maxConnections: 5,
      },
    ],
    configFields: [
      {
        key: 'cameraMotion',
        label: 'Camera Motion',
        type: 'select',
        defaultValue: 'pan',
        options: [
          { label: 'Static', value: 'static' },
          { label: 'Pan', value: 'pan' },
          { label: 'Zoom', value: 'zoom' },
          { label: 'Dolly', value: 'dolly' },
          { label: 'Orbit', value: 'orbit' },
        ],
      },
      {
        key: 'transitionType',
        label: 'Transition',
        type: 'select',
        defaultValue: 'dissolve',
        options: [
          { label: 'Cut', value: 'cut' },
          { label: 'Dissolve', value: 'dissolve' },
          { label: 'Fade', value: 'fade' },
          { label: 'Wipe', value: 'wipe' },
        ],
      },
      {
        key: 'fps',
        label: 'FPS',
        type: 'number',
        defaultValue: 24,
        min: 12,
        max: 60,
        step: 1,
      },
    ],
    supportedProviders: ['runway', 'pika'],
  },

  videoGenerator: {
    type: 'videoGenerator',
    label: 'Video Generator',
    category: NodeCategory.GENERATION,
    icon: 'Film',
    description: 'Generate video clips from frames or images',
    defaultData: {
      config: { duration: 4, resolution: '1080p', motionStrength: 5 },
    },
    inputs: [
      {
        id: 'frames',
        label: 'Frames',
        dataType: DataType.FRAME,
        isRequired: true,
        maxConnections: 1,
      },
    ],
    outputs: [
      {
        id: 'video',
        label: 'Video',
        dataType: DataType.VIDEO,
        isRequired: false,
        maxConnections: 5,
      },
    ],
    configFields: [
      {
        key: 'duration',
        label: 'Duration (sec)',
        type: 'slider',
        defaultValue: 4,
        min: 1,
        max: 15,
        step: 1,
      },
      {
        key: 'resolution',
        label: 'Resolution',
        type: 'select',
        defaultValue: '1080p',
        options: [
          { label: '720p', value: '720p' },
          { label: '1080p', value: '1080p' },
          { label: '4K', value: '4k' },
        ],
      },
      {
        key: 'motionStrength',
        label: 'Motion Strength',
        type: 'slider',
        defaultValue: 5,
        min: 1,
        max: 10,
        step: 1,
      },
    ],
    supportedProviders: ['runway', 'pika', 'stability'],
  },

  videoCombiner: {
    type: 'videoCombiner',
    label: 'Video Combiner',
    category: NodeCategory.PROCESSING,
    icon: 'Merge',
    description: 'Combine multiple video clips into one sequence',
    defaultData: {
      config: { transitionDuration: 0.5, addAudio: false },
    },
    inputs: [
      {
        id: 'videos',
        label: 'Videos',
        dataType: DataType.VIDEO,
        isRequired: true,
        maxConnections: 10,
      },
      {
        id: 'audio',
        label: 'Audio',
        dataType: DataType.AUDIO,
        isRequired: false,
        maxConnections: 1,
      },
    ],
    outputs: [
      {
        id: 'video',
        label: 'Combined Video',
        dataType: DataType.VIDEO,
        isRequired: false,
        maxConnections: 5,
      },
    ],
    configFields: [
      {
        key: 'transitionDuration',
        label: 'Transition Duration (sec)',
        type: 'slider',
        defaultValue: 0.5,
        min: 0,
        max: 3,
        step: 0.1,
      },
      {
        key: 'addAudio',
        label: 'Include Audio Track',
        type: 'toggle',
        defaultValue: false,
      },
    ],
    supportedProviders: [],
  },

  output: {
    type: 'output',
    label: 'Output',
    category: NodeCategory.OUTPUT,
    icon: 'Download',
    description: 'Final output node for exporting the generated video',
    defaultData: {
      config: { format: 'mp4', quality: 'high', includeSubtitles: false },
    },
    inputs: [
      {
        id: 'video',
        label: 'Video',
        dataType: DataType.VIDEO,
        isRequired: true,
        maxConnections: 1,
      },
    ],
    outputs: [],
    configFields: [
      {
        key: 'format',
        label: 'Output Format',
        type: 'select',
        defaultValue: 'mp4',
        options: [
          { label: 'MP4', value: 'mp4' },
          { label: 'WebM', value: 'webm' },
          { label: 'MOV', value: 'mov' },
        ],
      },
      {
        key: 'quality',
        label: 'Export Quality',
        type: 'select',
        defaultValue: 'high',
        options: [
          { label: 'Draft', value: 'draft' },
          { label: 'Standard', value: 'standard' },
          { label: 'High', value: 'high' },
          { label: 'Maximum', value: 'maximum' },
        ],
      },
      {
        key: 'includeSubtitles',
        label: 'Include Subtitles',
        type: 'toggle',
        defaultValue: false,
      },
    ],
    supportedProviders: [],
  },
};

export function getNodeDefinition(type: string): NodeDefinition | undefined {
  return NODE_REGISTRY[type];
}

export function getNodesByCategory(category: NodeCategory): NodeDefinition[] {
  return Object.values(NODE_REGISTRY).filter((n) => n.category === category);
}

export function getAllNodeTypes(): string[] {
  return Object.keys(NODE_REGISTRY);
}
