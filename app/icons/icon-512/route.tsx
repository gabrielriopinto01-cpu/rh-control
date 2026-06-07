import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: '#2563eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            color: 'white',
            fontSize: 220,
            fontWeight: 900,
            fontFamily: 'sans-serif',
            letterSpacing: -4,
          }}
        >
          RH
        </span>
      </div>
    ),
    { width: 512, height: 512 }
  )
}
