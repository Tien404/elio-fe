import { useId, useState } from 'react'
import { demo } from '@/services'
import { presets, type Preset } from '@/mocks/scenarios'
import { Icon } from '@/components/ui'

export function DemoFaultControls() {
  const [preset, setPreset] = useState<Preset>('normal'),
    [armed, setArmed] = useState(''),
    id = useId()
  if (!demo) return null
  return (
    <details className="dialog-demo-controls">
      <summary title="Demo request scenario">
        <span className="demo-tools-icon">
          <Icon name="settings" size={20} />
        </span>
        <span className="demo-tools-label">Demo request scenario</span>
      </summary>
      <div>
        <p>Mock review only. Finish loading, then arm the next request before saving.</p>
        <label htmlFor={id}>Next dialog request</label>
        <select id={id} value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
          {presets.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            demo!.scenarios.set(preset)
            setArmed(`Armed ${preset} for one request.`)
          }}
        >
          Arm dialog scenario
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            demo!.loseNextConfirmResponse()
            setArmed(
              'The next successful confirm will commit and lose its response. Check receipt or retry the same key.',
            )
          }}
        >
          Lose next confirm response
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            demo!.loseQuizResponse('start')
            setArmed('Next successful quiz start loses its response. Check existing attempt.')
          }}
        >
          Lose next quiz start response
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            demo!.loseQuizResponse('save')
            setArmed('Next successful quiz save loses its response. Check saved answers.')
          }}
        >
          Lose next quiz save response
        </button>
        {armed && <p role="status">{armed}</p>}
      </div>
    </details>
  )
}
