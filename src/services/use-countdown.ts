import { useEffect, useState } from 'react'
export function useCountdown(endAt: string, serverNow: string) {
  const initial = Math.max(0, Math.ceil((Date.parse(endAt) - Date.parse(serverNow)) / 1000)),
    [display, setDisplay] = useState({ key: serverNow, seconds: initial })
  useEffect(() => {
    const started = performance.now(),
      remaining = Date.parse(endAt) - Date.parse(serverNow)
    const timer = window.setInterval(
      () =>
        setDisplay({
          key: serverNow,
          seconds: Math.max(0, Math.ceil((remaining - (performance.now() - started)) / 1000)),
        }),
      250,
    )
    return () => window.clearInterval(timer)
  }, [endAt, serverNow])
  return display.key === serverNow ? display.seconds : initial
}
