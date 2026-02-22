import { BaseEdge, EdgeProps, getBezierPath } from '@xyflow/react'

export default function AnimatedEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data
}: EdgeProps) {
  // Restore elegant sweeping curves
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  // We cannot easily useTheme here without it re-rendering, but it's fine for simple properties
  const isDark = document.documentElement.classList.contains('dark')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const edgeColor = (data as any)?.color || (isDark ? '#818cf840' : '#818cf850') // Indigo alpha
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const animatedColor = (data as any)?.animatedColor || (data as any)?.color || (isDark ? '#a78bfa80' : '#8b5cf680') 
  
  // Uniform stroke width for all connections
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const weight = (data as any)?.weight || 0
  const strokeWidth = 2.5 // 固定所有连线的粗细
  const isAnimated = weight > 0

  return (
    <>
      <BaseEdge 
          path={edgePath} 
          markerEnd={markerEnd} 
          style={{ 
              ...style, 
              stroke: edgeColor,
              strokeWidth: strokeWidth,
              fill: 'none',
          }} 
      />
      
      {/* Animated Flow Segment */}
      {isAnimated && (
          <path
              d={edgePath}
              className="react-flow__edge-path"
              style={{
                  ...style,
                  stroke: animatedColor,
                  strokeWidth: strokeWidth * 0.9, // 加粗流动动画线条
                  fill: 'none',
                  strokeDasharray: '6 14', // 适当增大虚线间距适应加粗的线条
                  animation: 'dashdraw 1.5s linear infinite'
              }}
          />
      )}
      
      <style>
        {`
          @keyframes dashdraw {
            from {
              stroke-dashoffset: 16;
            }
            to {
              stroke-dashoffset: 0;
            }
          }
        `}
      </style>
    </>
  )
}

export const edgeTypes = {
    animated: AnimatedEdge
}
