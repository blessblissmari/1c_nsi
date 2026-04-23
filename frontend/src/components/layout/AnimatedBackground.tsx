export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <div
        className="bg-blob"
        style={{
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 70%)',
          top: '-10%',
          left: '-5%',
          animationDelay: '0s',
        }}
      />
      <div
        className="bg-blob"
        style={{
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 70%)',
          bottom: '-10%',
          right: '-5%',
          animationDelay: '-7s',
        }}
      />
      <div
        className="bg-blob"
        style={{
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(0,148,179,0.05) 0%, transparent 70%)',
          top: '40%',
          left: '50%',
          animationDelay: '-14s',
        }}
      />
    </div>
  )
}
