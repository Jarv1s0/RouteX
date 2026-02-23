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

  const edgeData = data as { color?: string; animatedColor?: string; weight?: number } | undefined

  // 优雅深紫色作为基底
  const edgeColor = edgeData?.color || (isDark ? '#8b5cf640' : '#8b5cf650') // violet-500 with opacity
  // 赛博朋克亮紫色作为高亮电波
  const boltColor = edgeData?.animatedColor || edgeData?.color || (isDark ? '#d8b4fe' : '#a855f7') // fuchsia/purple accents

  const weight = edgeData?.weight || 0
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
                  animation: 'lightning-bolt 6.5s linear infinite', // 减慢速度
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
