import type { Visual } from '../../types';
import { ArrayView, BarsView, GridView, IntervalsView, MapView, StackView, TextView } from './primitives';
import { GraphView, HeapView, ListView, TreeView } from './structures';

export function VisualView({ viz }: { viz: Visual }) {
  switch (viz.kind) {
    case 'array':
      return <ArrayView viz={viz} />;
    case 'bars':
      return <BarsView viz={viz} />;
    case 'grid':
      return <GridView viz={viz} />;
    case 'stack':
      return <StackView viz={viz} />;
    case 'map':
      return <MapView viz={viz} />;
    case 'text':
      return <TextView viz={viz} />;
    case 'intervals':
      return <IntervalsView viz={viz} />;
    case 'tree':
      return <TreeView viz={viz} />;
    case 'heap':
      return <HeapView viz={viz} />;
    case 'list':
      return <ListView viz={viz} />;
    case 'graph':
      return <GraphView viz={viz} />;
  }
}
