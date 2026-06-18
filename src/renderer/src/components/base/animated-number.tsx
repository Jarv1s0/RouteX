import React from 'react'

interface AnimatedNumberProps {
  end: number
  decimals?: number
  duration?: number
  preserveValue?: boolean
  className?: string
}

function formatAnimatedValue(value: number, decimals: number): string {
  return decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString()
}

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  end,
  decimals = 0,
  duration = 1,
  preserveValue = false,
  className
}) => {
  const [displayValue, setDisplayValue] = React.useState(end)
  const latestValueRef = React.useRef(end)

  React.useEffect(() => {
    const startValue = preserveValue ? latestValueRef.current : 0

    if (duration <= 0 || startValue === end) {
      latestValueRef.current = end
      setDisplayValue(end)
      return
    }

    const startTime = performance.now()
    let frameId = 0

    const tick = (now: number): void => {
      const progress = Math.min((now - startTime) / (duration * 1000), 1)
      const nextValue = startValue + (end - startValue) * progress

      latestValueRef.current = nextValue
      setDisplayValue(nextValue)

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick)
        return
      }

      latestValueRef.current = end
      setDisplayValue(end)
    }

    frameId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [duration, end, preserveValue])

  const content = formatAnimatedValue(displayValue, decimals)

  if (className) {
    return <span className={className}>{content}</span>
  }

  return <>{content}</>
}

export default AnimatedNumber

