import { BaseEdge, type EdgeProps, getBezierPath } from '@xyflow/react'
import type { TopologyEdge } from './graph'

export default function AnimatedEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data
}: EdgeProps<TopologyEdge>) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition
  })
  const active = (data?.upload || 0) + (data?.download || 0) > 0
  return (
    <>
      <BaseEdge path={path} markerEnd={markerEnd} className="topology-edge" style={style} />
      {active && <path d={path} className="topology-edge-traffic" aria-hidden="true" />}
    </>
  )
}

export const edgeTypes = { traffic: AnimatedEdge }
