import { useState } from 'react';
import type { BotStrength, FactionId } from '../types';
import { FACTIONS } from '../data';
import { SpriteArt } from './SpriteArt';
import { playUi } from '../audio';

export function FactionSelect({
  botStrength,
  onBotStrengthChange,
  onConfirm,
  onBack,
}: {
  botStrength: BotStrength;
  onBotStrengthChange: (strength: BotStrength) => void;
  onConfirm: (faction: FactionId) => void;
  onBack: () => void;
}) {
  const [picked, setPicked] = useState<FactionId>('magma');

  return (
    <div className="faction-select">
      <h2>Choose your coalition</h2>
      {(['magma', 'oasis'] as const).map((fid) => {
        const f = FACTIONS[fid];
        return (
          <button
            key={fid}
            className={`faction-card ${fid} ${picked === fid ? 'selected' : ''}`}
            onClick={() => {
              setPicked(fid);
              playUi('tap');
            }}
          >
            <h3>{f.name}</h3>
            <div className="tagline">{f.tagline}</div>
            <div className="roster">
              {f.cards.map((c) => (
                <div className="unit-dot" key={c.id} title={c.name}>
                  {c.species && <SpriteArt species={c.species} hue={c.hue} />}
                </div>
              ))}
              <div
                className="unit-dot"
                title="Phase Spell"
                style={{ fontSize: '0.9rem', color: fid === 'magma' ? '#ffd76a' : '#8dffcf' }}
              >
                ✦
              </div>
            </div>
          </button>
        );
      })}
      <div className="bot-strength">
        <span className="bot-strength-label">Bot strength</span>
        <div className="bot-strength-toggle" role="group" aria-label="Bot strength">
          {(['normal', 'strong'] as const).map((strength) => (
            <button
              key={strength}
              className={botStrength === strength ? 'selected' : ''}
              aria-pressed={botStrength === strength}
              onClick={() => {
                onBotStrengthChange(strength);
                playUi('tap');
              }}
            >
              {strength}
            </button>
          ))}
        </div>
        <span className="bot-strength-hint">
          {botStrength === 'strong' ? 'Sharper counters and tactical pressure' : 'Balanced for a first campaign'}
        </span>
      </div>
      <div className="menu-actions">
        <button className="btn btn-primary" onClick={() => onConfirm(picked)}>
          March to the Basalt Fields
        </button>
        <button className="btn btn-ghost" onClick={onBack}>
          ◂ Back
        </button>
      </div>
    </div>
  );
}
