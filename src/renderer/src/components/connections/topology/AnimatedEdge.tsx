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
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const isDark = document.documentElement.classList.contains('dark')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const edgeColor = (data as any)?.color || (isDark ? '#818cf840' : '#818cf850')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const boltColor = (data as any)?.animatedColor || (data as any)?.color || (isDark ? '#c4b5fd' : '#7c3aed')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const weight = (data as any)?.weight || 0
  const strokeWidth = 2
  const isAnimated = weight > 0

  return (
    <>
      {/* 底层静态路径 */}
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

      {/* 闪电脉搏：高亮电流快速扫过，然后短暂静默 */}
{/* 闪电脉搏：高亮电流快速扫过，然后短暂静默 */}
      {isAnimated && (
          <path
              d={edgePath}
              className="react-flow__edge-path"
              style={{
                  ...style,
                  stroke: boltColor,
                  strokeWidth: strokeWidth * 2.5, // 稍微加粗提高存在感
                  strokeLinecap: 'round',
                  fill: 'none',
                  strokeDasharray: '30 2000', // 增加发光段的长度
                  animation: 'lightning-bolt 3.5s linear infinite', // 减慢速度
                  filter: `drop-shadow(0 0 5px ${boltColor})`, // 添加发光滤镜
                  opacity: 1 // 确保完全不透明
              }}
          />
      )}
    </>
  )
}

export const edgeTypes = {
    animated: AnimatedEdge
}
