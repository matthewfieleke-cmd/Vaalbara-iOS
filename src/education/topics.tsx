/**
 * The six-chapter Intro to Music Theory curriculum. Each chapter teaches the
 * GENERAL concept first, then turns to the score of Vaalbara as its living
 * example set — every excerpt below is synthesized by the game's own engine.
 */

import type { ReactElement } from 'react';
import { DemoButton, IsoMixPair, WarriorCard, type QuizQuestion } from './components';
import { ChordStrip, MeterStrip, NoteValuePyramid, Staff } from './Notation';
import { getDemo } from './demos';

export interface TopicDef {
  id: string;
  title: string;
  icon: string;
  tagline: string;
  Body: () => ReactElement;
  quiz: QuizQuestion[];
}

const SCALE_LABELS_NAT = ['D', 'E', 'F', 'G', 'A', 'B♭', 'C', 'D'];
const SCALE_LABELS_HARM = ['D', 'E', 'F', 'G', 'A', 'B♭', 'C♯', 'D'];
const SCALE_NOTES_NAT = ['D4', 'E4', 'F4', 'G4', 'A4', 'Bb4', 'C5', 'D5'].map((name) => ({ name, dur: 'q' as const }));
const SCALE_NOTES_HARM = ['D4', 'E4', 'F4', 'G4', 'A4', 'Bb4', 'C#5', 'D5'].map((name) => ({ name, dur: 'q' as const }));

/** Theme A engraved: [step, name, dur] from the score's own table. */
const THEME_A_NOTES = [
  { name: 'D4', dur: 'q' as const },
  { name: 'F4', dur: 'q' as const },
  { name: 'E4', dur: 'e' as const },
  { name: 'D4', dur: 'e' as const },
  { name: 'A4', dur: 'h' as const },
  { name: 'Bb4', dur: 'q' as const },
  { name: 'A4', dur: 'e' as const },
  { name: 'G4', dur: 'e' as const },
  { name: 'F4', dur: 'q' as const },
];

const PROGRESSION = [
  { roman: 'i', name: 'D minor' },
  { roman: 'VI', name: 'B♭ major' },
  { roman: 'iv', name: 'G minor' },
  { roman: 'V', name: 'A major' },
];

/* ------------------------------ 1 · Key ---------------------------------- */

function KeySignatureBody(): ReactElement {
  return (
    <>
      <p>
        Almost every piece of music you know treats one note as <b>home</b>. Melodies wander away
        from it and back to it; endings feel finished when they land on it. That home note is the
        <b> tonic</b>, and the family of notes that orbits it is a <b>scale</b>. Together they define
        the piece's <b>key</b>. A <b>key signature</b> — the sharps or flats printed at the start of
        every staff line — tells a performer which notes stay raised or lowered for the whole piece,
        so the music doesn't have to re-mark them in every measure.
      </p>
      <p>
        Keys come in two broad characters. <b>Major</b> keys center a major scale — often heard as
        bright or open. <b>Minor</b> keys center a minor scale — darker, more urgent. The entire
        score of Vaalbara lives in <b>D minor</b>: one flat (B♭) in the key signature, with D as the
        home note. That single choice is why the whole battle feels like a gathering storm.
      </p>
      <Staff
        notes={SCALE_NOTES_NAT}
        keySig
        labels={SCALE_LABELS_NAT}
        demoId="scale-natural"
        noteTimes={getDemo('scale-natural').noteTimes}
      />
      <DemoButton
        id="scale-natural"
        label="The D natural minor scale"
        sub="Played on the score's soft keyboard voice — watch the staff light up"
      />
      <p>
        Composers often <b>raise the 7th degree</b> of a minor scale (here, C to C♯) so it sits one
        half step below the tonic and <i>leans</i> into it. That altered scale is <b>harmonic
        minor</b>, and the raised note is the <b>leading tone</b>. You will meet it again in the
        chord chapter — it is the engine of our score's forward pull.
      </p>
      <Staff
        notes={SCALE_NOTES_HARM}
        keySig
        labels={SCALE_LABELS_HARM}
        demoId="scale-harmonic"
        noteTimes={getDemo('scale-harmonic').noteTimes}
      />
      <DemoButton
        id="scale-harmonic"
        label="D harmonic minor"
        sub="Same scale, but hear C♯ lean hungrily into the final D"
      />
      <h3 className="edu-h3">Hearing the tonic's gravity</h3>
      <p>
        The tonic is not a rule — it's a feeling of gravity. In this excerpt a horn line wanders
        through the scale and refuses to settle… until it touches D. Notice how only that last note
        feels like <i>arriving</i>.
      </p>
      <DemoButton id="tonic-gravity" label="A melody finds its way home" sub="Ends on the tonic, D" />
      <p>
        Now listen to the score's suspense engine — the ostinato that opens every battle. Every note
        belongs to D minor, and the pattern keeps circling its low D. Even a rhythm part obeys the
        key.
      </p>
      <DemoButton id="ostinato-pulse" label="The battle ostinato" sub="The score's pulse, circling the tonic" />
    </>
  );
}

const KEY_QUIZ: QuizQuestion[] = [
  {
    prompt: 'A key signature with one flat can mean F major — or which minor key?',
    options: ['A minor', 'D minor', 'G minor', 'B minor'],
    answer: 1,
    explain: 'Every key signature is shared by a major key and its relative minor, a minor third below it. F major and D minor both carry one flat — our score uses the minor side.',
  },
  {
    prompt: 'In D minor, which note is the tonic?',
    options: ['A', 'F', 'D', 'C♯'],
    answer: 2,
    explain: 'The tonic is the scale\'s first degree and the music\'s home — in D minor, that is D itself.',
  },
  {
    prompt: 'Compared with D major, which scale degrees does D natural minor lower?',
    options: ['1, 4 and 5', '3, 6 and 7', '2 and 4', 'Only the 7th'],
    answer: 1,
    explain: 'Natural minor flattens the 3rd (F♯→F), 6th (B→B♭) and 7th (C♯→C). Those three lowered degrees are the source of minor\'s darker color.',
  },
  {
    prompt: 'Our score frequently raises C to C♯. That raised 7th comes from which scale?',
    options: ['D major', 'D dorian', 'D harmonic minor', 'The chromatic scale'],
    answer: 2,
    explain: 'Harmonic minor raises the 7th degree to create a leading tone a half step below the tonic — the pull you hear on every A-major bar of the loop.',
    listen: 'scale-harmonic',
    listenLabel: 'Hear D harmonic minor',
  },
  {
    prompt: 'Tap play. The horn melody finally comes to rest on one note. Which scale degree is it?',
    options: ['The dominant (5)', 'The leading tone (7)', 'The mediant (3)', 'The tonic (1)'],
    answer: 3,
    explain: 'Rest equals tonic. The line only feels finished when it lands on D — scale degree 1.',
    listen: 'tonic-gravity',
    listenLabel: 'Play the melody',
  },
];

/* ----------------------------- 2 · Chords -------------------------------- */

function ChordProgressionBody(): ReactElement {
  return (
    <>
      <p>
        Stack a note, the note a third above it, and a third above that — three alternating scale
        steps — and you have a <b>triad</b>, the basic chord of Western harmony. Build one on each
        scale degree and you get a family of chords that all belong to the key. A <b>chord
        progression</b> is a planned journey through that family: some chords feel restful, some
        restless, and the alternation of the two is how harmony creates <b>tension and release</b>.
      </p>
      <p>
        Musicians label the family with <b>Roman numerals</b> counted from the tonic —
        <b> uppercase for major</b> chords, <b>lowercase for minor</b>. In a minor key the tonic
        chord is <b>i</b>, and the chord on the 5th degree — the <b>dominant, V</b> — is the one
        that most wants to resolve home. Vaalbara's entire five-minute battle rides one loop:
      </p>
      <ChordStrip
        demoId="progression-loop"
        noteTimes={getDemo('progression-loop').noteTimes ?? []}
        chords={PROGRESSION}
        loop
      />
      <p className="edu-formula">Dm → B♭ → Gm → A &nbsp;=&nbsp; i → VI → iv → V</p>
      <div className="demo-grid">
        <DemoButton id="chord-i" label="i — D minor" sub="Home. Dark, stable" compact />
        <DemoButton id="chord-VI" label="VI — B♭ major" sub="A warm step away" compact />
        <DemoButton id="chord-iv" label="iv — G minor" sub="Gathering motion" compact />
        <DemoButton id="chord-V" label="V — A major" sub="Maximum lean toward home" compact />
      </div>
      <DemoButton
        id="progression-loop"
        label="The full loop, from the score"
        sub="Two cycles with the ostinato riding on top — watch the numerals"
      />
      <h3 className="edu-h3">The cadence: harmony's punctuation</h3>
      <p>
        A <b>cadence</b> is how a progression punctuates a phrase. The strongest is
        <b> V → i</b> (the <b>authentic cadence</b>), powered by the <b>leading tone</b>: our A
        chord contains C♯, one half step below D, and that half step is a coiled spring. Notice the
        A chord is <i>major</i> in a minor key — that borrowed C♯ from harmonic minor is precisely
        what makes the resolution decisive.
      </p>
      <ChordStrip
        demoId="cadence"
        noteTimes={getDemo('cadence').noteTimes ?? []}
        chords={[{ roman: 'iv', name: 'G minor' }, { roman: 'V', name: 'A major' }, { roman: 'i', name: 'home' }]}
      />
      <DemoButton id="cadence" label="iv → V → i cadence" sub="Hear C♯ pull the loop home to D" />
      <p>
        One more score device: every eighth bar our A chord first <b>suspends</b> — it holds the
        note D over the chord (a <b>4–3 suspension</b>), creating a gentle dissonance that resolves
        down to C♯ before the cadence. Tension inside a single chord.
      </p>
      <DemoButton id="suspension" label="The 4–3 suspension" sub="Asus4 → A → Dm, exactly as the score plays it" />
    </>
  );
}

const CHORD_QUIZ: QuizQuestion[] = [
  {
    prompt: 'In the analysis i–VI–iv–V, what does a lowercase numeral tell you about a chord?',
    options: ['It is played quietly', 'It is a minor chord', 'It is out of key', 'It is an inversion'],
    answer: 1,
    explain: 'Case carries quality: uppercase numerals are major chords, lowercase are minor. Our i and iv are minor; VI and V are major.',
  },
  {
    prompt: 'Which chord of our loop is the dominant?',
    options: ['D minor', 'B♭ major', 'G minor', 'A major'],
    answer: 3,
    explain: 'The dominant is the chord on scale degree 5 — A in the key of D minor. It carries the leading tone and drives the music home.',
  },
  {
    prompt: 'The C♯ inside the A chord is called the…',
    options: ['Suspension', 'Leading tone', 'Pedal point', 'Root'],
    answer: 1,
    explain: 'C♯ sits one half step below the tonic D, and its pull toward D is what gives V → i its power. That half-step magnet is the leading tone.',
  },
  {
    prompt: 'Tap play. The motion that ends this excerpt — V resolving to i — is called…',
    options: ['A deceptive cadence', 'A plagal cadence', 'An authentic cadence', 'A half cadence'],
    answer: 2,
    explain: 'V → i (or V → I in major) is the authentic cadence, the strongest close in tonal music. Deceptive avoids home; plagal is iv → i; half STOPS on V.',
    listen: 'cadence',
    listenLabel: 'Play the cadence',
  },
  {
    prompt: 'A triad is built by stacking which interval?',
    options: ['Seconds', 'Thirds', 'Fourths', 'Octaves'],
    answer: 1,
    explain: 'Triads stack two thirds: root, third, fifth. D–F–A spells our tonic D minor triad.',
  },
];

/* ----------------------------- 3 · Melody -------------------------------- */

function MelodyBody(): ReactElement {
  return (
    <>
      <p>
        Melody is the line you leave humming — pitches in rhythm, one after another. Composers build
        melodies from a <b>motif</b>: a short, recognizable idea that gets repeated, varied and
        developed. A complete musical sentence made of motifs is a <b>phrase</b>, and the melody's
        rise and fall across a phrase is its <b>contour</b>. Great themes balance <b>repetition</b>
        (so you learn them) with <b>variation</b> (so they stay alive).
      </p>
      <p>
        Vaalbara has one central melody — <b>Theme A</b>, the rising horn line that binds the intro,
        the menu and both battle phases into one piece. Here is its opening phrase, engraved. Play
        it and follow the notes as they light:
      </p>
      <Staff
        notes={THEME_A_NOTES}
        keySig
        timeSig
        proportional
        demoId="theme-a"
        noteTimes={getDemo('theme-a').noteTimes}
      />
      <DemoButton
        id="theme-a"
        label="Theme A — the Vaalbara motif"
        sub="Horns over the score's i → VI harmony"
      />
      <p>
        Study its contour: it climbs stepwise D–F, dips, then <b>leaps a perfect fifth</b> to A —
        the reach — before settling down through B♭. Up slowly, down gracefully: the classic arch.
        The score also answers Theme A with a second strain, <b>Theme B</b> — a descending
        <b> response</b> that begins where A reached, so the two strains converse.
      </p>
      <DemoButton id="theme-b" label="Theme B — the response" sub="Starts on the reach, settles low" />
      <p>
        Composers also <b>fragment</b> a theme — quoting just its head as a whisper. Minutes 1–2 of
        the battle score do exactly this, seeding the full statement to come:
      </p>
      <DemoButton id="theme-frag" label="The fragment" sub="Theme A's first gesture only, as the verse whisper" />
      <h3 className="edu-h3">Phrases and arrival: melody meets harmony</h3>
      <p>
        A theme's entrance is planned against the harmony, not dropped at random. Strong statements
        enter on a <b>downbeat of the tonic chord</b>, where the harmonic cycle restarts — so the
        melody's beginning feels like an <b>arrival</b>. Our score keeps a strict contract: every
        statement of Theme A begins on the downbeat of a D-minor bar. Listen to a cycle end (iv, then
        V with its C♯ pull) and hear the theme land precisely as the new cycle opens:
      </p>
      <DemoButton
        id="phrase-arrival"
        label="The arrival"
        sub="Cycle ends on V… Theme A enters ON the new tonic downbeat"
      />
    </>
  );
}

const MELODY_QUIZ: QuizQuestion[] = [
  {
    prompt: 'A short, recognizable musical idea that a piece keeps developing is called a…',
    options: ['Cadence', 'Motif', 'Scale', 'Chord'],
    answer: 1,
    explain: 'The motif is melody\'s building block — Theme A\'s opening D–F–E–D–A gesture is Vaalbara\'s.',
  },
  {
    prompt: 'Theme A leaps from D4 up to A4 at its peak. That interval is a…',
    options: ['Major third', 'Perfect fourth', 'Perfect fifth', 'Octave'],
    answer: 2,
    explain: 'D up to A spans five scale steps (D-E-F-G-A) — a perfect fifth, the most stable leap in the scale. It makes the reach feel heroic, not strained.',
    listen: 'theme-a',
    listenLabel: 'Play Theme A',
  },
  {
    prompt: 'Theme B begins on Theme A\'s highest note and descends. Its relationship to Theme A is best described as…',
    options: ['An exact repetition', 'An answering response', 'A key change', 'A drum fill'],
    answer: 1,
    explain: 'B inverts A\'s energy — it starts on the reach and settles, so the two strains form a call and response. Variation keeps a single motif fresh for five minutes.',
    listen: 'theme-b',
    listenLabel: 'Play Theme B',
  },
  {
    prompt: 'Quoting only the head of a theme — as our score whispers in minutes 1–2 — is called…',
    options: ['Fragmentation', 'Transposition', 'Inversion', 'Augmentation'],
    answer: 0,
    explain: 'Fragmentation develops a theme by isolating a piece of it. The whisper plants the motif in your ear before the full statement arrives.',
  },
  {
    prompt: 'Theme A always enters on the downbeat of a D-minor bar. What does this alignment create?',
    options: ['Syncopation', 'A sense of arrival', 'A key signature', 'Dissonance'],
    answer: 1,
    explain: 'Entering with the tonic downbeat — where the harmonic cycle restarts — makes each statement land as an arrival rather than an interruption. Melody and harmony move as one.',
    listen: 'phrase-arrival',
    listenLabel: 'Hear the arrival',
  },
];

/* ----------------------------- 4 · Harmony ------------------------------- */

function HarmonyBody(): ReactElement {
  return (
    <>
      <p>
        Harmony is what happens when pitches sound <b>together</b>. Its atom is the
        <b> interval</b> — the distance between two notes. Intervals have size (second, third,
        fifth…) and quality (major, minor, perfect), and each has a personality:
        <b> consonant</b> intervals (octaves, fifths, thirds, sixths) sound stable and restful, while
        <b> dissonant</b> ones (seconds, sevenths) carry tension that asks to resolve. Music needs
        both — consonance is the arrival, dissonance is the journey.
      </p>
      <div className="demo-grid">
        <DemoButton id="interval-p5" label="Perfect fifth (D–A)" sub="Open, stable — the score's spine" compact />
        <DemoButton id="interval-m3" label="Minor third (D–F)" sub="The sound of minor" compact />
        <DemoButton id="interval-M3" label="Major third (B♭–D)" sub="The sound of major" compact />
        <DemoButton id="interval-m2" label="Minor second (C♯–D)" sub="Dissonance — hear it crave resolution" compact />
      </div>
      <p>
        When independent lines harmonize, two more principles appear. <b>Voice leading</b>: each
        voice should move smoothly — by step where possible — as the chords change beneath it. And
        the <b>drone</b> (or pedal point): one voice holds a single note while harmony moves around
        it, creating waves of tension and release against the stationary tone.
      </p>
      <h3 className="edu-h3">The warriors are the second orchestra</h3>
      <p>
        In battle, Vaalbara's creatures join the score as sections of the ensemble. Tap each card
        for a guided listening example — about twenty seconds, narrated as it plays.
      </p>
      <WarriorCard
        species="eagle"
        demoId="eagle-duet"
        title="The Eagles"
        role="Two voices in thirds &amp; sixths"
        hint="Tap to hear one Eagle sing through the chords — then a second joins in harmony."
      />
      <WarriorCard
        species="bees"
        demoId="bee-hive"
        title="The Swarm of Bees"
        role="A drone on the fifth"
        hint="Tap to hear the hive hold its drone on A while the chords move — then a second swarm adds the chord tones."
      />
      <p>
        Everything you just heard is general technique, not game trickery: the Eagles demonstrate
        <b> chord tones and voice leading</b>; the Bees demonstrate the <b>drone</b>, plus the
        leading tone C♯ appearing exactly where the harmony demands it. Composers from Bach to film
        scores harmonize melodies in thirds and sixths and anchor storms over pedal points — you now
        know why it works.
      </p>
    </>
  );
}

const HARMONY_QUIZ: QuizQuestion[] = [
  {
    prompt: 'Tap play. This open, stable interval — D up to A — is a…',
    options: ['Minor third', 'Perfect fifth', 'Major sixth', 'Minor seventh'],
    answer: 1,
    explain: 'Five scale steps from D to A make a perfect fifth, the most consonant interval after the octave — which is why the score builds its foundations on it.',
    listen: 'interval-p5',
    listenLabel: 'Play the interval',
  },
  {
    prompt: 'Consonant intervals such as thirds and sixths are best described as sounding…',
    options: ['Tense and unstable', 'Stable and restful', 'Out of tune', 'Percussive'],
    answer: 1,
    explain: 'Consonance rests; dissonance leans. That\'s why the second Eagle harmonizes in thirds and sixths — the duet stays sweet against every chord.',
  },
  {
    prompt: 'Tap play. C♯ grinding against D is which dissonant interval?',
    options: ['Minor second', 'Major third', 'Perfect fourth', 'Unison'],
    answer: 0,
    explain: 'One half step apart — a minor second, the sharpest common dissonance. Resolve the C♯ up to D and the tension releases; that is the leading tone at work.',
    listen: 'interval-m2',
    listenLabel: 'Play the clash',
  },
  {
    prompt: 'The Bees hold one steady note while the chords change underneath. That device is called a…',
    options: ['Cadence', 'Glissando', 'Drone (pedal point)', 'Trill'],
    answer: 2,
    explain: 'A drone or pedal point holds one tone against moving harmony. The hive\'s A fits every chord in our loop, so the tension breathes in and out without ever breaking.',
    listen: 'bee-hive',
    listenLabel: 'Hear the hive',
  },
  {
    prompt: 'The second Eagle\'s line moves by small steps from chord to chord instead of leaping. That craft is called…',
    options: ['Voice leading', 'Modulation', 'Orchestration', 'Transposition'],
    answer: 0,
    explain: 'Voice leading is the art of moving each voice smoothly as harmony changes. The Eagle pair\'s stepwise motion is why their duet sounds like singing, not sirens.',
    listen: 'eagle-duet',
    listenLabel: 'Hear the duet',
  },
];

/* ----------------------- 5 · Time Signature / Rhythm ---------------------- */

function RhythmBody(): ReactElement {
  return (
    <>
      <p>
        Rhythm begins with the <b>beat</b> — the steady pulse you nod to. Its speed is the
        <b> tempo</b>, measured in beats per minute; Vaalbara's score runs at <b>100 BPM</b>, one
        beat every 0.6 seconds. Beats group into <b>measures</b> (bars), and the first beat of each
        measure — the <b>downbeat</b> — carries the strongest natural accent. A
        <b> time signature</b> declares the grouping: our <b>4/4</b> means <i>four beats per
        measure</i> (top number), with the <i>quarter note carrying the beat</i> (bottom number).
      </p>
      <MeterStrip demoId="measures" noteTimes={getDemo('measures').noteTimes ?? []} />
      <DemoButton
        id="measures"
        label="Measures and downbeats"
        sub="The taiko marks beat 1 — count along: ONE two three four"
      />
      <h3 className="edu-h3">Note values: dividing the beat</h3>
      <p>
        Note values are simple arithmetic. A <b>whole note</b> fills a 4/4 measure; two
        <b> half notes</b> split it; four <b>quarter notes</b> mark the beats; <b>eighth notes</b>
        halve each beat ("1 &amp; 2 &amp;…"); <b>sixteenth notes</b> quarter it ("1-e-&amp;-a").
        Each row below lasts exactly as long as every other row:
      </p>
      <NoteValuePyramid />
      <div className="demo-grid">
        <DemoButton id="note-whole" label="Whole notes" sub="The string bed — one chord per measure" compact />
        <DemoButton id="note-quarter" label="Quarter notes" sub="The kick drum — the beat itself" compact />
        <DemoButton id="note-eighth" label="Eighth notes" sub="The ostinato strings — two per beat" compact />
        <DemoButton id="note-sixteenth" label="Sixteenth notes" sub="The minute-5 toms — four per beat" compact />
      </div>
      <h3 className="edu-h3">Syncopation: accenting the "and"</h3>
      <p>
        Meter creates expectation: strong beats, weak beats. <b>Syncopation</b> deliberately
        accents where the meter is weak — between the beats — and the surprise creates propulsion.
        Listen to the same pulse twice: accents on the beat, then accents on the off-beats. The
        score's tick-hats live in that second world, riding between the sixteenths through the
        entire battle.
      </p>
      <DemoButton id="syncopation" label="On-beat vs. off-beat" sub="Feel the lean when the accents move" />
      <h3 className="edu-h3">A sixteenth-note masterclass, by the Fire Ants</h3>
      <WarriorCard
        species="fireants"
        demoId="fireants-16ths"
        title="The Fire Ants"
        role="Four bites to the beat"
        hint="Tap to hear the ants pack four even sixteenths into single beats — count 1-e-&amp;-a."
      />
    </>
  );
}

const RHYTHM_QUIZ: QuizQuestion[] = [
  {
    prompt: 'In the time signature 4/4, the top number tells you…',
    options: ['The tempo in BPM', 'How many beats fill each measure', 'How many measures are in the piece', 'How loud to play'],
    answer: 1,
    explain: 'Top number: beats per measure. Bottom number: which note value carries the beat — 4 meaning the quarter note.',
  },
  {
    prompt: 'The first beat of every measure is called the…',
    options: ['Backbeat', 'Upbeat', 'Downbeat', 'Off-beat'],
    answer: 2,
    explain: 'The downbeat is the measure\'s strongest natural accent — our taiko marks it, and Theme A always enters on one.',
    listen: 'measures',
    listenLabel: 'Hear the downbeats',
  },
  {
    prompt: 'How many sixteenth notes fit in one measure of 4/4?',
    options: ['4', '8', '12', '16'],
    answer: 3,
    explain: 'Four per beat × four beats = sixteen. The minute-5 tom groove plays every single one.',
    listen: 'note-sixteenth',
    listenLabel: 'Hear a measure of sixteenths',
  },
  {
    prompt: 'Tap play and listen to the SECOND half of the excerpt. Where do the accents fall?',
    options: ['On every downbeat', 'Between the beats — the off-beats', 'Only on beat 3', 'Randomly'],
    answer: 1,
    explain: 'The accents shift onto the "and" of each beat — syncopation. Accenting where the meter is weak is what creates that forward lean.',
    listen: 'syncopation',
    listenLabel: 'Play the comparison',
  },
  {
    prompt: 'At 100 BPM in 4/4, roughly how long does one full measure last?',
    options: ['About 0.6 seconds', 'About 1.2 seconds', 'About 2.4 seconds', 'About 4 seconds'],
    answer: 2,
    explain: 'One beat = 60 ÷ 100 = 0.6 s, and four beats make the measure: 2.4 seconds. Every excerpt in this course is built on that grid.',
  },
];

/* --------------------------- 6 · Percussion ------------------------------- */

function PercussionBody(): ReactElement {
  return (
    <>
      <p>
        Percussion is the orchestra's engine room: instruments struck to mark time, shape accents
        and control energy. A rock <b>drum kit</b> divides those jobs — the <b>kick</b> anchors the
        low pulse, the <b>snare</b> cracks the accents, <b>hi-hats</b> keep the subdivision ticking,
        <b> toms</b> carry melodic drum figures and fills, and <b>cymbals</b> crown arrivals.
        Vaalbara adds a cinematic <b>taiko</b> underneath — the great drum that breathes with the
        battle. Meet the kit:
      </p>
      <div className="demo-grid">
        <DemoButton id="kit-kick" label="Kick" sub="The driving quarter pulse" compact />
        <DemoButton id="kit-snare" label="Snare" sub="The crack of the accents" compact />
        <DemoButton id="kit-hat" label="Tick-hats" sub="The score's syncopated sixteenth ride" compact />
        <DemoButton id="kit-tom" label="Toms" sub="Pitched drums, high to low" compact />
        <DemoButton id="kit-crash" label="Crash" sub="Arrival punctuation" compact />
        <DemoButton id="kit-taiko" label="Taiko" sub="The cinematic floor beneath the kit" compact />
      </div>
      <h3 className="edu-h3">The rock drummer of minutes 4–5</h3>
      <p>
        As the battle builds, a full rock drummer takes the stage — and minutes 4 and 5 of the score
        are a compact course in groove construction. Each figure below is exactly what the drummer
        plays there. Hear it <b>isolated</b> first, then <b>in the mix</b> with the guitars and
        strings around it.
      </p>
      <IsoMixPair
        iso="backbeat-iso"
        mix="backbeat-mix"
        label="The backbeat"
        sub="Snare on beats 2 &amp; 4 against the kick — the heartbeat of rock (minute 4's verse)"
      />
      <IsoMixPair
        iso="tom-groove-iso"
        mix="tom-groove-mix"
        label="The sixteenth tom groove"
        sub="Minute 5's relentless engine: all sixteen subdivisions, accented in fours"
      />
      <IsoMixPair
        iso="fill-iso"
        mix="fill-mix"
        label="The turnaround fill"
        sub="Every second bar: a snare-and-tom run up the last beat, crashing onto the downbeat"
      />
      <IsoMixPair
        iso="halftime-iso"
        mix="halftime-mix"
        label="Half-time"
        sub="The kit opens up — kick on 1, one enormous snare on 3. Mass with room to land"
      />
      <h3 className="edu-h3">Dynamics: the drummer as dramatist</h3>
      <p>
        <b>Dynamics</b> — the control of loud and soft — is percussion's greatest dramatic power.
        The score's signature move is the <b>suckout and slam</b>: at the end of a cycle the entire
        band cuts away, a lone snare roll <b>crescendos</b> through the silence, and the new cycle
        lands with everything at once — Theme A included, on the tonic downbeat you learned about in
        Melody. Maximum tension, instant release:
      </p>
      <DemoButton
        id="suckout-slam"
        label="The suckout &amp; slam"
        sub="Groove → gathering → silence and snare roll → THE SLAM with Theme A"
      />
      <p>
        Listen for it around minutes 4 and 5 of any long battle — now you'll hear it as a musician
        does: a drummer conducting the whole orchestra's dynamics with one roll.
      </p>
    </>
  );
}

const PERCUSSION_QUIZ: QuizQuestion[] = [
  {
    prompt: 'In a rock groove, the snare striking beats 2 and 4 is called the…',
    options: ['Downbeat', 'Backbeat', 'Pickup', 'Turnaround'],
    answer: 1,
    explain: 'The backbeat accents the meter\'s weak beats — a built-in syncopation that gives rock its drive. Minute 4\'s verses ride it constantly.',
    listen: 'backbeat-iso',
    listenLabel: 'Hear the backbeat',
  },
  {
    prompt: 'Tap play. The run of snare and toms at the end of every second bar, leading back to the downbeat, is called a…',
    options: ['Fill', 'Drone', 'Cadence', 'Vamp'],
    answer: 0,
    explain: 'A fill bridges phrases — it signals "new section incoming" and lands you on the crash. Ours runs up the last beat with a flam at its end.',
    listen: 'fill-iso',
    listenLabel: 'Play the fill',
  },
  {
    prompt: 'When the kit moves to half-time, the big snare accent moves to which beat?',
    options: ['Beat 1', 'Beat 2', 'Beat 3', 'Beat 4'],
    answer: 2,
    explain: 'Half-time stretches the backbeat: kick on 1, snare on 3. The tempo doesn\'t change, but the groove feels twice as wide — that\'s minute 5\'s power-ballad bars.',
    listen: 'halftime-iso',
    listenLabel: 'Hear half-time',
  },
  {
    prompt: 'Tap play. Just before the slam, the band cuts out while a snare roll grows louder. That growth is called a…',
    options: ['Decrescendo', 'Crescendo', 'Ritardando', 'Fermata'],
    answer: 1,
    explain: 'A crescendo is a controlled increase in loudness. The suckout empties the stage so the roll\'s crescendo carries ALL the tension into the slam.',
    listen: 'suckout-slam',
    listenLabel: 'Play the suckout & slam',
  },
  {
    prompt: 'Which drum carries the relentless sixteenth-note groove in minute 5 of our score?',
    options: ['The hi-hat', 'The kick', 'The toms', 'The crash'],
    answer: 2,
    explain: 'The toms — accented in groups of four, high drum answering low — are minute 5\'s engine, with the kick driving eighths underneath.',
    listen: 'tom-groove-iso',
    listenLabel: 'Hear the tom groove',
  },
];

/* -------------------------------- registry ------------------------------- */

export const TOPICS: TopicDef[] = [
  {
    id: 'key',
    title: 'Key Signature',
    icon: '♭',
    tagline: 'Scales, the tonic, and why D minor sounds like a storm',
    Body: KeySignatureBody,
    quiz: KEY_QUIZ,
  },
  {
    id: 'chords',
    title: 'Chord Progression',
    icon: '♫',
    tagline: 'Triads, Roman numerals, and the i–VI–iv–V engine',
    Body: ChordProgressionBody,
    quiz: CHORD_QUIZ,
  },
  {
    id: 'melody',
    title: 'Melody',
    icon: '𝄞',
    tagline: 'Motif, contour, and Theme A on the staff',
    Body: MelodyBody,
    quiz: MELODY_QUIZ,
  },
  {
    id: 'harmony',
    title: 'Harmony',
    icon: '♩',
    tagline: 'Intervals, voice leading — and the Eagles & Bees singing chords',
    Body: HarmonyBody,
    quiz: HARMONY_QUIZ,
  },
  {
    id: 'rhythm',
    title: 'Time Signature & Rhythm',
    icon: '♪',
    tagline: 'Measures, note values, syncopation, and the 4/4 grid',
    Body: RhythmBody,
    quiz: RHYTHM_QUIZ,
  },
  {
    id: 'percussion',
    title: 'Percussion',
    icon: '✕',
    tagline: 'The kit, the groove, and the minute-4–5 rock drummer',
    Body: PercussionBody,
    quiz: PERCUSSION_QUIZ,
  },
];
