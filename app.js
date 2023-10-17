window.AudioContext = window.AudioContext || window.webkitAudioContext;

let ctx;
let oscillators = {};
let voices = {}; // Object to store active voices
let activeVoices = 0;
const waveform = 'sawtooth'; // Wave forms = sine, square, sawtooth, triangle
const maxVoices = 100; // Maximum number of concurrent voices


const startButton = document.querySelector('button');

startButton.addEventListener('click', () => {
    ctx = new AudioContext();
    console.log(ctx);

    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess().then(success, failure);
    }
});

function midiToFreq(midinumber) {
    const a = 440;
    return (a / 32) * (2 ** ((midinumber - 9) / 12));
}

function success(midiAccess) {
    console.log(midiAccess);
    const inputs = midiAccess.inputs;

    inputs.forEach((input) => {
        console.log(input);
        input.addEventListener('midimessage', handleInput);
    });
}

function handleInput(input) {
    const command = input.data[0];
    const note = input.data[1];
    const velocity = input.data[2];

    if (command >= 144 && command <= 156) {
        if (activeVoices < maxVoices) {
            noteOn(note, velocity);
            activeVoices++;
        }   
    } else if (command >= 128 && command <= 143) {
        noteOff(note);
    } else if (velocity === 0) {
        noteOff(note);
    }
}

function noteOn(note, velocity) {
    if (!ctx) {
        return; // Exit if AudioContext is not initialized
    }

    // Check if voice for the note already exists, and release it
    if (voices[note]) {
        noteOff(note);        
    }

    const oscillator = ctx.createOscillator();
    const newEnvelope = {
        attackTime: 0.1,
        decayTime: 0.2,
        sustainLevel: 0.5,
        releaseTime: 0.2,
        startTime: ctx.currentTime
    };

    const newOscGain = ctx.createGain();
    oscillators[note.toString()] = { osc: oscillator, envelope: newEnvelope, oscGain: newOscGain };

    const { osc, envelope, oscGain } = oscillators[note.toString()];
    const { attackTime, decayTime, sustainLevel, releaseTime, startTime } = envelope;

    osc.type = waveform;
    osc.frequency.value = midiToFreq(note);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    oscGain.gain.setValueAtTime(0, startTime);
    oscGain.gain.linearRampToValueAtTime(velocity, startTime + attackTime);
    oscGain.gain.linearRampToValueAtTime(sustainLevel * velocity, startTime + attackTime + decayTime);

    osc.start();

    // Schedule note-off event
    const releaseEndTime = startTime + releaseTime;
    const duration = releaseEndTime - ctx.currentTime;

    setTimeout(() => {
        noteOff(note);
    }, duration * 1000); // Convert duration to milliseconds

    // Store the voice in the voices object
    voices[note] = { oscillator, envelope, oscGain };
}

function noteOff(note) {
    const voice = voices[note];
    if (voice) {
        const { oscillator, envelope, oscGain } = voice;
        const { releaseTime } = envelope;
        const releaseEndTime = ctx.currentTime + releaseTime;
        
        oscGain.gain.setValueAtTime(oscGain.gain.value, ctx.currentTime);
        oscGain.gain.linearRampToValueAtTime(0, releaseEndTime);

        oscillator.stop(releaseEndTime);

        delete voices[note];
        activeVoices--;
    }
}

function failure() {
    console.log('Could not connect MIDI');
}
