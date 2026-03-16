import { describe, it, expect, beforeEach } from 'vitest';

import { GraphResolver } from '../../../src/engine/graph.resolver.js';
import type {
  IWorkflowNode,
  IWorkflowEdge,
} from '../../../src/engine/engine.types.js';

// Helper to create a node with minimal required fields
function createNode(
  id: string,
  type: IWorkflowNode['type'],
): IWorkflowNode {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    config: {},
  };
}

// Helper to create an edge
function createEdge(
  id: string,
  sourceNodeId: string,
  sourcePort: string,
  targetNodeId: string,
  targetPort: string,
): IWorkflowEdge {
  return { id, sourceNodeId, sourcePort, targetNodeId, targetPort };
}

describe('GraphResolver', () => {
  let resolver: GraphResolver;

  beforeEach(() => {
    resolver = new GraphResolver();
  });

  describe('validate', () => {
    it('should reject empty workflow', () => {
      const result = resolver.validate([], []);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Workflow must have at least one node',
      );
    });

    it('should accept a single node with no edges', () => {
      const nodes = [createNode('n1', 'script-input')];
      const result = resolver.validate(nodes, []);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject duplicate node IDs', () => {
      const nodes = [
        createNode('n1', 'script-input'),
        createNode('n1', 'output'),
      ];
      const result = resolver.validate(nodes, []);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Duplicate node IDs found');
    });

    it('should reject edges referencing non-existent nodes', () => {
      const nodes = [createNode('n1', 'script-input')];
      const edges = [
        createEdge('e1', 'n1', 'script', 'n999', 'script'),
      ];
      const result = resolver.validate(nodes, edges);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('non-existent');
    });

    it('should reject self-loop edges', () => {
      const nodes = [createNode('n1', 'script-input')];
      const edges = [createEdge('e1', 'n1', 'script', 'n1', 'script')];
      const result = resolver.validate(nodes, edges);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('self-loop');
    });

    it('should accept a valid linear DAG', () => {
      const nodes = [
        createNode('n1', 'script-input'),
        createNode('n2', 'script-analyzer'),
        createNode('n3', 'output'),
      ];
      const edges = [
        createEdge('e1', 'n1', 'script', 'n2', 'script'),
        createEdge('e2', 'n2', 'analysis', 'n3', 'video'),
      ];
      // Note: port type mismatch will cause validation error for text->video
      // So let's use a valid pipeline
      const validNodes = [
        createNode('n1', 'script-input'),
        createNode('n2', 'script-analyzer'),
      ];
      const validEdges = [
        createEdge('e1', 'n1', 'script', 'n2', 'script'),
      ];
      const result = resolver.validate(validNodes, validEdges);
      expect(result.isValid).toBe(true);
    });

    it('should reject a graph with a simple cycle', () => {
      const nodes = [
        createNode('n1', 'script-input'),
        createNode('n2', 'script-analyzer'),
      ];
      const edges = [
        createEdge('e1', 'n1', 'script', 'n2', 'script'),
        createEdge('e2', 'n2', 'script', 'n1', 'script'),
      ];
      const result = resolver.validate(nodes, edges);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('cycle'))).toBe(true);
    });

    it('should reject a graph with a complex cycle (3 nodes)', () => {
      const nodes = [
        createNode('n1', 'script-input'),
        createNode('n2', 'script-analyzer'),
        createNode('n3', 'character-extractor'),
      ];
      const edges = [
        createEdge('e1', 'n1', 'script', 'n2', 'script'),
        createEdge('e2', 'n2', 'script', 'n3', 'script'),
        createEdge('e3', 'n3', 'characters', 'n1', 'script'),
      ];
      const result = resolver.validate(nodes, edges);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('cycle'))).toBe(true);
    });

    it('should reject incompatible port types', () => {
      const nodes = [
        createNode('n1', 'script-input'),
        createNode('n2', 'frame-composer'),
      ];
      const edges = [
        createEdge('e1', 'n1', 'script', 'n2', 'images'),
      ];
      const result = resolver.validate(nodes, edges);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('type mismatch'))).toBe(true);
    });

    it('should reject non-existent source port', () => {
      const nodes = [
        createNode('n1', 'script-input'),
        createNode('n2', 'script-analyzer'),
      ];
      const edges = [
        createEdge('e1', 'n1', 'nonexistent', 'n2', 'script'),
      ];
      const result = resolver.validate(nodes, edges);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('no output port'))).toBe(
        true,
      );
    });

    it('should reject non-existent target port', () => {
      const nodes = [
        createNode('n1', 'script-input'),
        createNode('n2', 'script-analyzer'),
      ];
      const edges = [
        createEdge('e1', 'n1', 'script', 'n2', 'nonexistent'),
      ];
      const result = resolver.validate(nodes, edges);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('no input port'))).toBe(
        true,
      );
    });

    it('should reject disconnected nodes', () => {
      const nodes = [
        createNode('n1', 'script-input'),
        createNode('n2', 'output'),
      ];
      // No edges connecting them
      const result = resolver.validate(nodes, []);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Disconnected'))).toBe(true);
    });

    it('should reject multiple terminal nodes', () => {
      const nodes = [
        createNode('n1', 'script-input'),
        createNode('n2', 'script-analyzer'),
        createNode('n3', 'character-extractor'),
      ];
      const edges = [
        createEdge('e1', 'n1', 'script', 'n2', 'script'),
        createEdge('e2', 'n1', 'script', 'n3', 'script'),
      ];
      const result = resolver.validate(nodes, edges);
      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((e) => e.includes('exactly one terminal')),
      ).toBe(true);
    });

    it('should accept a valid full pipeline', () => {
      const nodes = [
        createNode('n1', 'script-input'),
        createNode('n2', 'scene-splitter'),
        createNode('n3', 'image-generator'),
        createNode('n4', 'video-generator'),
        createNode('n5', 'output'),
      ];
      const edges = [
        createEdge('e1', 'n1', 'script', 'n2', 'script'),
        createEdge('e2', 'n2', 'scenes', 'n3', 'scenes'),
        createEdge('e3', 'n3', 'images', 'n4', 'images'),
        createEdge('e4', 'n4', 'video', 'n5', 'video'),
      ];
      const result = resolver.validate(nodes, edges);
      expect(result.isValid).toBe(true);
    });
  });

  describe('getExecutionLayers', () => {
    it('should return single layer for one node', () => {
      const nodes = [createNode('n1', 'script-input')];
      const layers = resolver.getExecutionLayers(nodes, []);
      expect(layers).toHaveLength(1);
      expect(layers[0].layer).toBe(0);
      expect(layers[0].nodeIds).toEqual(['n1']);
    });

    it('should return correct layers for a linear DAG', () => {
      const nodes = [
        createNode('n1', 'script-input'),
        createNode('n2', 'script-analyzer'),
        createNode('n3', 'output'),
      ];
      const edges = [
        createEdge('e1', 'n1', 'script', 'n2', 'script'),
        createEdge('e2', 'n2', 'analysis', 'n3', 'video'),
      ];
      const layers = resolver.getExecutionLayers(nodes, edges);
      expect(layers).toHaveLength(3);
      expect(layers[0].nodeIds).toEqual(['n1']);
      expect(layers[1].nodeIds).toEqual(['n2']);
      expect(layers[2].nodeIds).toEqual(['n3']);
    });

    it('should group parallel nodes into the same layer', () => {
      // n1 -> n2 -> n4
      // n1 -> n3 -> n4
      const nodes = [
        createNode('n1', 'script-input'),
        createNode('n2', 'script-analyzer'),
        createNode('n3', 'character-extractor'),
        createNode('n4', 'scene-splitter'),
      ];
      const edges = [
        createEdge('e1', 'n1', 'script', 'n2', 'script'),
        createEdge('e2', 'n1', 'script', 'n3', 'script'),
        createEdge('e3', 'n2', 'script', 'n4', 'script'),
        createEdge('e4', 'n3', 'characters', 'n4', 'characters'),
      ];
      const layers = resolver.getExecutionLayers(nodes, edges);
      expect(layers).toHaveLength(3);
      expect(layers[0].nodeIds).toEqual(['n1']);
      expect(layers[1].nodeIds.sort()).toEqual(['n2', 'n3'].sort());
      expect(layers[2].nodeIds).toEqual(['n4']);
    });

    it('should handle fan-out correctly', () => {
      // n1 -> n2 (scene-splitter)
      // n2 -> n3 (image-generator)
      // n2 -> n4 (image-generator)
      // n3 -> n5 (video-combiner)
      // n4 -> n5 (video-combiner)
      const nodes = [
        createNode('n1', 'script-input'),
        createNode('n2', 'scene-splitter'),
        createNode('n3', 'image-generator'),
        createNode('n4', 'image-generator'),
        createNode('n5', 'video-combiner'),
      ];
      const edges = [
        createEdge('e1', 'n1', 'script', 'n2', 'script'),
        createEdge('e2', 'n2', 'scenes', 'n3', 'scenes'),
        createEdge('e3', 'n2', 'scenes', 'n4', 'scenes'),
        createEdge('e4', 'n3', 'images', 'n5', 'videos'),
        createEdge('e5', 'n4', 'images', 'n5', 'videos'),
      ];
      const layers = resolver.getExecutionLayers(nodes, edges);
      expect(layers).toHaveLength(4);
      expect(layers[0].nodeIds).toEqual(['n1']);
      expect(layers[1].nodeIds).toEqual(['n2']);
      expect(layers[2].nodeIds.sort()).toEqual(['n3', 'n4'].sort());
      expect(layers[3].nodeIds).toEqual(['n5']);
    });
  });

  describe('toBullMQFlow', () => {
    it('should create a reversed tree with root as terminal node', () => {
      const nodes = [
        createNode('n1', 'script-input'),
        createNode('n2', 'script-analyzer'),
        createNode('n3', 'output'),
      ];
      const edges = [
        createEdge('e1', 'n1', 'script', 'n2', 'script'),
        createEdge('e2', 'n2', 'analysis', 'n3', 'video'),
      ];

      const flow = resolver.toBullMQFlow(nodes, edges, 'exec-123');

      // Root should be the output node (terminal)
      expect(flow.data.nodeId).toBe('n3');
      expect(flow.data.executionId).toBe('exec-123');
      expect(flow.children).toHaveLength(1);
      expect(flow.children![0].data.nodeId).toBe('n2');
      expect(flow.children![0].children).toHaveLength(1);
      expect(flow.children![0].children![0].data.nodeId).toBe('n1');
      expect(flow.children![0].children![0].children).toBeUndefined();
    });

    it('should set correct job IDs', () => {
      const nodes = [
        createNode('n1', 'script-input'),
        createNode('n2', 'output'),
      ];
      const edges = [
        createEdge('e1', 'n1', 'script', 'n2', 'video'),
      ];

      const flow = resolver.toBullMQFlow(nodes, edges, 'exec-456');

      expect(flow.opts?.jobId).toBe('exec-456:n2');
      expect(flow.children![0].opts?.jobId).toBe('exec-456:n1');
    });

    it('should handle branching (multiple children)', () => {
      const nodes = [
        createNode('n1', 'script-input'),
        createNode('n2', 'script-analyzer'),
        createNode('n3', 'character-extractor'),
        createNode('n4', 'scene-splitter'),
      ];
      const edges = [
        createEdge('e1', 'n1', 'script', 'n2', 'script'),
        createEdge('e2', 'n1', 'script', 'n3', 'script'),
        createEdge('e3', 'n2', 'script', 'n4', 'script'),
        createEdge('e4', 'n3', 'characters', 'n4', 'characters'),
      ];

      const flow = resolver.toBullMQFlow(nodes, edges, 'exec-789');

      // Root = n4 (terminal)
      expect(flow.data.nodeId).toBe('n4');
      // n4 has two children: n2 and n3
      expect(flow.children).toHaveLength(2);
      const childNodeIds = flow.children!.map((c) => c.data.nodeId).sort();
      expect(childNodeIds).toEqual(['n2', 'n3']);
    });

    it('should include queue name and node type in job data', () => {
      const nodes = [createNode('n1', 'script-input')];
      const flow = resolver.toBullMQFlow(nodes, [], 'exec-1');

      expect(flow.queueName).toBe('workflow-execution');
      expect(flow.data.nodeType).toBe('script-input');
      expect(flow.name).toBe('script-input:n1');
    });
  });

  describe('identifyFanOutNodes', () => {
    it('should identify scene-splitter as fan-out', () => {
      const nodes = [
        createNode('n1', 'script-input'),
        createNode('n2', 'scene-splitter'),
        createNode('n3', 'image-generator'),
      ];
      const edges = [
        createEdge('e1', 'n1', 'script', 'n2', 'script'),
        createEdge('e2', 'n2', 'scenes', 'n3', 'scenes'),
      ];

      const fanOutIds = resolver.identifyFanOutNodes(nodes, edges);
      expect(fanOutIds).toEqual(['n2']);
    });

    it('should return empty array when no fan-out nodes exist', () => {
      const nodes = [
        createNode('n1', 'script-input'),
        createNode('n2', 'script-analyzer'),
      ];
      const edges = [
        createEdge('e1', 'n1', 'script', 'n2', 'script'),
      ];

      const fanOutIds = resolver.identifyFanOutNodes(nodes, edges);
      expect(fanOutIds).toEqual([]);
    });

    it('should identify multiple fan-out nodes', () => {
      const nodes = [
        createNode('n1', 'scene-splitter'),
        createNode('n2', 'scene-splitter'),
        createNode('n3', 'script-input'),
      ];

      const fanOutIds = resolver.identifyFanOutNodes(nodes, []);
      expect(fanOutIds.sort()).toEqual(['n1', 'n2'].sort());
    });
  });

  describe('port compatibility validation', () => {
    it('should accept compatible port types (script → script)', () => {
      const nodes = [
        createNode('n1', 'script-input'),
        createNode('n2', 'script-analyzer'),
      ];
      const edges = [
        createEdge('e1', 'n1', 'script', 'n2', 'script'),
      ];
      const result = resolver.validate(nodes, edges);
      expect(result.isValid).toBe(true);
    });

    it('should accept compatible port types (scenes → scenes)', () => {
      const nodes = [
        createNode('n1', 'scene-splitter'),
        createNode('n2', 'image-generator'),
      ];
      // scene-splitter needs script input, but we test just the edge port compat
      // This test focuses on the edge between scene-splitter output and image-generator input
      const edges = [
        createEdge('e1', 'n1', 'scenes', 'n2', 'scenes'),
      ];
      // This will fail reachability/terminal validation with just 2 nodes + 1 edge
      // but port compatibility itself should pass
      const result = resolver.validate(nodes, edges);
      // Check that there's no port mismatch error (other errors may exist)
      const hasMismatch = result.errors.some((e) =>
        e.includes('type mismatch'),
      );
      expect(hasMismatch).toBe(false);
    });

    it('should reject incompatible port types (script → image)', () => {
      const nodes = [
        createNode('n1', 'script-input'),
        createNode('n2', 'frame-composer'),
      ];
      const edges = [
        createEdge('e1', 'n1', 'script', 'n2', 'images'),
      ];
      const result = resolver.validate(nodes, edges);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('type mismatch'))).toBe(
        true,
      );
    });

    it('should accept video → video for video-combiner', () => {
      const nodes = [
        createNode('n1', 'video-generator'),
        createNode('n2', 'video-combiner'),
      ];
      const edges = [
        createEdge('e1', 'n1', 'video', 'n2', 'videos'),
      ];
      const result = resolver.validate(nodes, edges);
      const hasMismatch = result.errors.some((e) =>
        e.includes('type mismatch'),
      );
      expect(hasMismatch).toBe(false);
    });
  });
});
