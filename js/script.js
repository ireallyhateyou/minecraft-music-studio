class NBSEditor {
    constructor() {
        this.instruments = this.getDefaultInstruments(); // Store instrument list here
        this.song = {
            name: "My Song",
            author: "Player",
            originalAuthor: "",
            description: "",
            tempo: 120,
            timeSignature: 4,
            length: 0,
            // Refactored: tracks array, each with instrument and notes
            tracks: [
                {
                    instrument: 0, // default instrument id
                    notes: {},     // key: "noteIndex,tick", value: { instrument, pitch }
                    volume: 100 // default volume
                }
            ]
        };

        this.audioContext = null; // Will be initialized after user interaction
        this.buffers = new Map();
        this.currentInstrument = 0;
        this.isPlaying = false;
        this.currentTick = 0;
        this.totalTicks = 64;
        this.isDragging = false;
        this.playInterval = null;
        this.currentTrackIndex = 0; // Track currently being edited/viewed
        this.fullViewMode = false; // Track full view state
        this.audioInitializing = false; // Flag to prevent multiple simultaneous audio initializations
        // Default note names (will be updated per instrument)
        this.noteNames = [
            'F♯3', 'G3', 'G♯3', 'A3', 'A♯3', 'B3', 'C4', 'C♯4', 'D4', 'D♯4', 'E4', 'F4', 'F♯4',
            'G4', 'G♯4', 'A4', 'A♯4', 'B4', 'C5', 'C♯5', 'D5', 'D♯5', 'E5', 'F5', 'F♯5'
        ];

        // Undo/Redo system
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;

        this.init();
    }

    getDefaultInstruments() {
        return [
            { id: 0, name: "Harp", color: "#8a6d3b", range: "F♯3–F♯5" }, // Default/Any other blocks
            { id: 1, name: "Bass", color: "#5a4a28", range: "F♯1–F♯3" }, // Wood
            { id: 2, name: "Bass Drum", color: "#666666", range: "—" }, // Stone, Blackstone, etc.
            { id: 3, name: "Snare Drum", color: "#c2b280", range: "—" }, // Sand, Gravel, Concrete Powder
            { id: 4, name: "Clicks and Sticks", color: "#a0a0a0", range: "—" }, // Glass, Sea Lantern, Beacon
            { id: 5, name: "Guitar", color: "#c94a4a", range: "F♯2–F♯4" }, // Wool
            { id: 6, name: "Flute", color: "#7f9fb6", range: "F♯4–F♯6" }, // Clay, Honeycomb Block
            { id: 7, name: "Bell", color: "#f2b01a", range: "F♯5–F♯7" }, // Block of Gold
            { id: 8, name: "Chime", color: "#5c9ec7", range: "F♯5–F♯7" }, // Packed Ice
            { id: 9, name: "Xylophone", color: "#e3dac9", range: "F♯5–F♯7" }, // Bone Block
            { id: 10, name: "Iron Xylophone", color: "#b0b0b0", range: "F♯3–F♯5" }, // Block of Iron
            { id: 11, name: "Cow Bell", color: "#7e6b5a", range: "F♯4–F♯6" }, // Soul Sand
            { id: 12, name: "Didgeridoo", color: "#d87f33", range: "F♯1–F♯3" }, // Pumpkin
            { id: 13, name: "Bit", color: "#17dd62", range: "F♯3–F♯5" }, // Block of Emerald
            { id: 14, name: "Banjo", color: "#dcd83e", range: "F♯3–F♯5" }, // Hay Bale
            { id: 15, name: "Pling", color: "#e8e83c", range: "F♯3–F♯5" }, // Glowstone
            { id: 16, name: "Skeleton", color: "#d1d1d1", range: "—" }, // Skeleton Skull
            { id: 17, name: "Wither Skeleton", color: "#4a4a4a", range: "—" }, // Wither Skeleton Skull
            { id: 18, name: "Zombie", color: "#7a9c7a", range: "—" }, // Zombie Head
            { id: 19, name: "Creeper", color: "#4a7a4a", range: "—" }, // Creeper Head
            { id: 20, name: "Piglin", color: "#ffb366", range: "—" }, // Piglin Head
            { id: 21, name: "Ender Dragon", color: "#9933cc", range: "—" } // Dragon Head
        ];
    }

    async init() {
        this.setupUI();
        this.generateNoteGrid();
        this.setupEventListeners();
        this.renderTrackTabs(); // Render tabs after setup
        this.updateVolumeSlider(); // Initialize volume slider
        this.saveState(); // Save initial state
        
        // Show audio notice initially
        const audioNotice = document.getElementById('audioNotice');
        if (audioNotice) {
            // Check if we can create an audio context immediately (user has already interacted)
            try {
                const testContext = new (window.AudioContext || window.webkitAudioContext)();
                if (testContext.state === 'running') {
                    audioNotice.style.display = 'none';
                    testContext.close();
                } else {
                    audioNotice.style.display = 'block';
                    testContext.close();
                }
            } catch (e) {
                audioNotice.style.display = 'block';
            }
        }
        
        // Note: Audio loading is now done after user interaction to comply with autoplay policies
    }

    async loadInstrumentSounds() {
        // Initialize audio context if not already done
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Don't reload if already loaded
        if (this.buffers.size > 0) {
            return;
        }
        
        // Create a promise for each instrument to load its OGG file
        const loadPromises = this.instruments.map(instrument => 
            this.loadAudioBuffer(`assets/instruments/${instrument.id}.ogg`)
        );
    
        // Wait for all instruments to load, but don't fail if some fail
        const results = await Promise.allSettled(loadPromises);
        
        // Store loaded buffers in the map
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                this.buffers.set(this.instruments[index].id, result.value);
            } else {
                console.warn(`Failed to load instrument ${this.instruments[index].id}:`, result.reason);
                // Create a fallback buffer for this instrument
                const fallbackBuffer = this.createSynthBuffer(this.instruments[index].id);
                this.buffers.set(this.instruments[index].id, fallbackBuffer);
            }
        });
    }
    
    createSynthBuffer(instrumentId = 0) {
        // Create a simple synthesized tone as fallback
        const sampleRate = this.audioContext.sampleRate;
        const duration = 0.5; // 0.5 seconds
        const numSamples = Math.floor(sampleRate * duration);
        
        const buffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
        const channelData = buffer.getChannelData(0);
        
        // Different base frequencies for different instrument types
        let baseFrequency = 440; // A4 note
        
        // Adjust frequency based on instrument type
        if (instrumentId >= 2 && instrumentId <= 4) {
            // Drums - lower frequency, more percussive
            baseFrequency = 200;
        } else if (instrumentId >= 5 && instrumentId <= 6) {
            // Guitar/Flute - higher frequency
            baseFrequency = 660;
        } else if (instrumentId >= 7 && instrumentId <= 11) {
            // Bells/Chimes - very high frequency
            baseFrequency = 880;
        }
        
        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            // Apply envelope to avoid clicks
            const envelope = Math.min(1, t / 0.01) * Math.max(0, 1 - (t - (duration - 0.05)) / 0.05);
            
            // Different waveforms for different instruments
            let wave;
            if (instrumentId >= 2 && instrumentId <= 4) {
                // Drums - noise-like
                wave = (Math.random() - 0.5) * 2;
            } else {
                // Melodic instruments - sine wave
                wave = Math.sin(2 * Math.PI * baseFrequency * t);
            }
            
            channelData[i] = wave * envelope * 0.3;
        }
        
        return buffer;
    }

    async loadAudioBuffer(url) {
        try {
            // Ensure audio context is initialized
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            // Extract instrument ID from URL for fallback
            const instrumentId = parseInt(url.match(/(\d+)\.ogg$/)?.[1] || '0');
            
            // Fetch audio file
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            
            // Decode audio data
            return await this.audioContext.decodeAudioData(arrayBuffer);
        } catch (error) {
            console.error(`Error loading audio: ${url}`, error);
            // Fallback to synthesized sound if loading fails
            const instrumentId = parseInt(url.match(/(\d+)\.ogg$/)?.[1] || '0');
            return this.createSynthBuffer(instrumentId);
        }
    }

    setupUI() {
        const selector = document.getElementById('instrumentSelector');
        selector.innerHTML = '';
        this.instruments.forEach(instrument => {
            const option = document.createElement('option');
            option.value = instrument.id;
            option.textContent = instrument.name;
            selector.appendChild(option);
        });
    }

    generateNoteGrid() {
        const gridContainer = document.getElementById('gridContainer');
        const noteLabels = document.querySelector('.piano-keys');
        const tickLabels = document.querySelector('.tick-labels');
        
        console.log('=== Grid Generation Debug ===');
        console.log('totalTicks:', this.totalTicks);
        console.log('Grid container:', gridContainer);
        
        noteLabels.innerHTML = '';
        tickLabels.innerHTML = '';
        gridContainer.innerHTML = '';
        
        // Update CSS custom property for song length
        document.documentElement.style.setProperty('--song-length', this.totalTicks);
        console.log('Set CSS --song-length to:', this.totalTicks);
        
        // Analyze the song to find the actual note range used
        let minNote = 24; // Start with highest note (F#5)
        let maxNote = 0;  // Start with lowest note (F#3)
        let hasNotes = false;
        
        // Check all tracks for notes
        for (const track of this.song.tracks) {
            for (const key in track.notes) {
                const [noteIndex] = key.split(',').map(Number);
                if (noteIndex >= 0 && noteIndex <= 24) {
                    minNote = Math.min(minNote, noteIndex);
                    maxNote = Math.max(maxNote, noteIndex);
                    hasNotes = true;
                }
            }
        }
        
        // If no notes found, use default range (middle octave)
        if (!hasNotes) {
            minNote = 8;  // C4
            maxNote = 20; // C5
        }
        
        // Add some padding to the range
        minNote = Math.max(0, minNote - 2);
        maxNote = Math.min(24, maxNote + 2);
        
        const noteRange = maxNote - minNote + 1;
        console.log('Note range:', minNote, 'to', maxNote, '(', noteRange, 'notes)');
        
        // Update CSS custom property for note range
        document.documentElement.style.setProperty('--note-range', noteRange);
        console.log('Set CSS --note-range to:', noteRange);
        
        // Generate tick labels (0 to totalTicks-1)
        console.log('Generating', this.totalTicks, 'tick labels...');
        for (let tick = 0; tick < this.totalTicks; tick++) {
            const tickLabel = document.createElement('div');
            tickLabel.className = 'tick-label';
            tickLabel.textContent = tick;
            tickLabels.appendChild(tickLabel);
        }
        
        // Generate note labels (only the range we need)
        const noteNames = this.getCurrentNoteNames();
        console.log('Generating', noteRange, 'note labels...');
        for (let i = minNote; i <= maxNote; i++) {
            const label = document.createElement('div');
            label.className = 'note-label';
            label.textContent = noteNames[i] || '';
            noteLabels.appendChild(label);
        }
        
        // Generate grid cells (totalTicks x noteRange)
        console.log('Generating', this.totalTicks * noteRange, 'grid cells...');
        for (let i = minNote; i <= maxNote; i++) {
            for (let tick = 0; tick < this.totalTicks; tick++) {
                const cell = document.createElement('div');
                cell.className = 'note-cell';
                cell.dataset.note = i;
                cell.dataset.tick = tick;
                gridContainer.appendChild(cell);
            }
        }
        
        // Update CSS grid template rows to match the new note range
        const gridContainerStyle = gridContainer.style;
        gridContainerStyle.gridTemplateRows = `repeat(${noteRange}, 25px)`;
        
        console.log('Grid generation complete. Total cells:', gridContainer.children.length);
        console.log('Grid dimensions:', this.totalTicks, 'x', noteRange);
        console.log('=== End Grid Debug ===');
        
        // Restore visual state of notes after regenerating grid
        this.restoreNoteVisuals();
    }

    // Update all references to this.song.notes and this.song.instruments to use the first track for now
    // For example, in generateNoteGrid, toggleNote, playTick, clear, etc.
    // Example for generateNoteGrid:
    // In toggleNote, use the current track and its instrument color
    toggleNote(cell, forceState = null) {
        const noteIndex = parseInt(cell.dataset.note);
        const tick = parseInt(cell.dataset.tick);
        const noteKey = `${noteIndex},${tick}`;
        const track = this.song.tracks[this.currentTrackIndex];
        const shouldActivate = forceState !== null ? forceState : !track.notes[noteKey];

        if (shouldActivate) {
            // Remove any existing notes on the same tick (one note per tick rule)
            for (const existingKey in track.notes) {
                const [, existingTick] = existingKey.split(',').map(Number);
                if (existingTick === tick) {
                    // Remove the existing note from the data
                    delete track.notes[existingKey];
                    
                    // Remove the visual representation
                    const existingCell = document.querySelector(`[data-note="${existingKey.split(',')[0]}"][data-tick="${tick}"]`);
                    if (existingCell) {
                        existingCell.classList.remove('active');
                        existingCell.style.backgroundColor = '';
                    }
                }
            }
            
            // Add the new note
            track.notes[noteKey] = {
                instrument: track.instrument,
                pitch: noteIndex
            };
            cell.classList.add('active');
            cell.style.backgroundColor = this.instruments[track.instrument]?.color || '';
            this.playNote(noteIndex, track.instrument);
            this.saveState();
        } else {
            delete track.notes[noteKey];
            cell.classList.remove('active');
            cell.style.backgroundColor = '';
            this.saveState();
        }
    }

    playNote(noteIndex, instrumentId = null, time = 0) {
        // Ensure audio context is initialized and ready
        if (!this.audioContext || this.audioContext.state === 'suspended') {
            console.warn('Audio context not ready, skipping note playback');
            return;
        }
        
        const source = this.audioContext.createBufferSource();
        // Use the passed instrumentId or fall back to current track's instrument
        const track = this.song.tracks[this.currentTrackIndex];
        const instrumentToUse = instrumentId !== null ? instrumentId : track.instrument;
        
        // Get buffer, create fallback if not available
        let buffer = this.buffers.get(instrumentToUse);
        if (!buffer) {
            buffer = this.createSynthBuffer(instrumentToUse);
            this.buffers.set(instrumentToUse, buffer);
        }
        
        source.buffer = buffer;
        
        const semitones = noteIndex - 12;
        source.playbackRate.value = Math.pow(2, semitones / 12);
        
        // Create a gain node for volume control
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = track.volume / 100; // Convert percentage to 0-1 range
        
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        source.start(this.audioContext.currentTime + time);
    }

    play() {
        if (this.isPlaying) return;
        
        // Ensure audio context is initialized and resumed
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Resume audio context if it's suspended
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        this.isPlaying = true;
        document.getElementById('playBtn').disabled = true;
        document.getElementById('pauseBtn').disabled = false;
        document.getElementById('stopBtn').disabled = false;
        
        // Show playhead when playing
        document.getElementById('playhead').style.display = 'block';
        
        // Calculate tick duration: (60 seconds / BPM) * 1000ms / 4 ticks per beat
        const tickDuration = (60 / this.song.tempo) * 1000 / 4;
        console.log('=== Playhead Debug ===');
        console.log('BPM:', this.song.tempo);
        console.log('Tick duration (ms):', tickDuration);
        console.log('Ticks per second:', 1000 / tickDuration);
        console.log('Beats per second:', (1000 / tickDuration) / 4);
        console.log('Total ticks in song:', this.totalTicks);
        console.log('Expected song duration (seconds):', (this.totalTicks / 4) / (this.song.tempo / 60));
        console.log('=== End Playhead Debug ===');
        
        this.updatePlayhead();
        
        let intervalCount = 0;
        let lastIntervalTime = Date.now();
        this.playInterval = setInterval(() => {
            intervalCount++;
            const currentTime = Date.now();
            const timeSinceLastInterval = currentTime - lastIntervalTime;
            lastIntervalTime = currentTime;
            
            console.log(`=== Interval Debug #${intervalCount} ===`);
            console.log(`Interval triggered at: ${currentTime}`);
            console.log(`Time since last interval: ${timeSinceLastInterval}ms (expected: ${tickDuration}ms)`);
            console.log(`Timing accuracy: ${Math.abs(timeSinceLastInterval - tickDuration)}ms off`);
            console.log(`Current tick before update: ${this.currentTick}`);
            
            this.playTick(this.currentTick);
            this.currentTick++;
            console.log(`Current tick after update: ${this.currentTick}`);
            
            // Stop if we've reached the end
            if (this.currentTick >= this.totalTicks) {
                console.log('Reached end of song in interval, stopping');
                this.stop();
                return;
            }
            
            this.updatePlayhead();
            console.log(`=== End Interval Debug #${intervalCount} ===`);
        }, tickDuration);
    }

    // Find the next tick that has notes to play
    findNextTickWithNotes(startTick) {
        for (let i = 0; i < this.totalTicks; i++) {
            const tick = (startTick + i) % this.totalTicks;
            // Check if any track has notes at this tick
            for (const track of this.song.tracks) {
                for (const key in track.notes) {
                    const [, noteTick] = key.split(',').map(Number);
                    if (noteTick === tick) {
                        return tick;
                    }
                }
            }
        }
        return startTick; // If no notes found, stay at current position
    }

    // Update playhead to move linearly with tempo
    updatePlayhead() {
        const playhead = document.getElementById('playhead');
        // Move playhead linearly based on current tick position
        // Start at 64px (left edge of grid container) and move 25px per tick
        const playheadLeft = 64 + (this.currentTick * 25);
        playhead.style.left = `${playheadLeft}px`;
        
        console.log(`=== Playhead Update Debug ===`);
        console.log(`Current tick: ${this.currentTick}`);
        console.log(`Playhead left position: ${playheadLeft}px`);
        console.log(`Total ticks: ${this.totalTicks}`);
        console.log(`Is playing: ${this.isPlaying}`);
        console.log(`=== End Playhead Update ===`);
        
        // Sync scrollbar with playhead position
        this.syncScrollbarWithPlayhead();
    }
    
    syncScrollbarWithPlayhead() {
        const pianoRoll = document.querySelector('.piano-roll');
        if (!pianoRoll) return;
        
        // Don't auto-scroll if user is manually scrolling
        if (this.isUserScrolling && this.isUserScrolling()) {
            console.log('Skipping auto-scroll - user is manually scrolling');
            return;
        }
        
        // Don't auto-scroll if not playing (to avoid interference with manual positioning)
        if (!this.isPlaying) {
            console.log('Skipping auto-scroll - not currently playing');
            return;
        }
        
        // Calculate the scroll position based on playhead position
        const gridContainer = document.getElementById('gridContainer');
        if (!gridContainer) return;
        
        // Calculate the center position of the playhead relative to the grid
        const playheadCenter = 64 + (this.currentTick * 25) + 12.5; // 12.5 is half of 25px cell width
        
        // Calculate the scroll position to center the playhead
        const pianoRollWidth = pianoRoll.clientWidth;
        const scrollLeft = playheadCenter - (pianoRollWidth / 2);
        
        // Apply smooth scrolling to the piano roll
        pianoRoll.scrollTo({
            left: Math.max(0, scrollLeft),
            behavior: 'smooth'
        });
        
        console.log(`Auto-scrolled to center playhead at tick ${this.currentTick}`);
    }
    
    updatePlayheadFromScroll() {
        const pianoRoll = document.querySelector('.piano-roll');
        if (!pianoRoll) return;
        
        // Don't update playhead position during playback to maintain consistent BPM
        if (this.isPlaying) {
            console.log('Skipping playhead update from scroll during playback');
            return;
        }
        
        // Calculate the center of the visible area
        const pianoRollWidth = pianoRoll.clientWidth;
        const scrollLeft = pianoRoll.scrollLeft;
        const centerPosition = scrollLeft + (pianoRollWidth / 2);
        
        // Convert center position to tick position
        // Subtract 64px (piano keys width) and divide by 25px per tick
        const tickPosition = Math.max(0, Math.floor((centerPosition - 64) / 25));
        
        // Update current tick if it's different
        if (tickPosition !== this.currentTick) {
            this.currentTick = Math.min(tickPosition, this.totalTicks - 1);
            this.updatePlayhead();
            console.log(`Updated playhead from scroll: tick ${tickPosition} (only when not playing)`);
        }
    }

    // In playTick, use the current track for now
    playTick(tick) {
        console.log(`=== PlayTick Debug ===`);
        console.log(`Playing tick: ${tick}`);
        console.log(`Total ticks: ${this.totalTicks}`);
        console.log(`Is playing: ${this.isPlaying}`);
        
        // Reset all playing states
        document.querySelectorAll('.note-cell.playing').forEach(cell => {
            cell.classList.remove('playing');
        });
        
        // Check if we've reached the end of the song
        if (tick >= this.totalTicks) {
            console.log('Reached end of song, stopping playback');
            // Song is finished, hide playhead and stop playback
            document.getElementById('playhead').style.display = 'none';
            this.stop();
            return;
        }
        
        let notesPlayed = 0;
        // Play notes for all tracks at this tick
        for (const track of this.song.tracks) {
            for (const key in track.notes) {
                const [noteIndex, noteTick] = key.split(',').map(Number);
                if (noteTick === tick) {
                    console.log(`Playing note: index=${noteIndex}, tick=${tick}, instrument=${track.instrument}`);
                    // Play the note
                    this.playNoteWithTrackVolume(noteIndex, track.instrument, track.volume);
                    notesPlayed++;
                    
                    // Highlight the cell as playing
                    const cell = document.querySelector(`[data-note="${noteIndex}"][data-tick="${tick}"]`);
                    if (cell) {
                        cell.classList.add('playing');
                        console.log(`Highlighted cell for note ${noteIndex} at tick ${tick}`);
                    } else {
                        console.warn(`Could not find cell for note ${noteIndex} at tick ${tick}`);
                    }
                }
            }
        }
        
        console.log(`Played ${notesPlayed} notes at tick ${tick}`);
        console.log(`=== End PlayTick Debug ===`);
    }

    pause() {
        this.isPlaying = false;
        clearInterval(this.playInterval);
        document.getElementById('playBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
        // Hide playhead when paused
        document.getElementById('playhead').style.display = 'none';
    }

    stop() {
        this.pause();
        this.currentTick = 0;
        this.updatePlayhead();
        document.getElementById('stopBtn').disabled = true;
        // Hide playhead when stopped
        document.getElementById('playhead').style.display = 'none';
    }

    // In clear, use the current track
    clear() {
        const track = this.song.tracks[this.currentTrackIndex];
        track.notes = {};
        document.querySelectorAll('.note-cell.active').forEach(cell => {
            cell.classList.remove('active');
            cell.style.backgroundColor = '';
        });
        this.saveState(); // Save state after clearing
    }

    renderTrackTabs() {
        const tabBar = document.getElementById('trackTabs');
        tabBar.innerHTML = '';
        this.song.tracks.forEach((track, idx) => {
            const tab = document.createElement('button');
            tab.className = 'track-tab' + (idx === this.currentTrackIndex ? ' active' : '');
            const instrumentName = this.instruments[track.instrument]?.name || `Instrument ${track.instrument}`;
            tab.textContent = instrumentName;
            tab.addEventListener('click', () => {
                this.currentTrackIndex = idx;
                this.generateNoteGrid();
                this.restoreNoteVisuals();
                this.renderTrackTabs();
                this.updateInstrumentSelector();
                this.updateVolumeSlider();
            });
            // Remove button (if more than 1 track)
            if (this.song.tracks.length > 1) {
                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-track';
                removeBtn.textContent = '×';
                removeBtn.title = 'Remove track';
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.song.tracks.splice(idx, 1);
                    if (this.currentTrackIndex >= this.song.tracks.length) {
                        this.currentTrackIndex = this.song.tracks.length - 1;
                    }
                    this.generateNoteGrid();
                    this.restoreNoteVisuals();
                    this.renderTrackTabs();
                    this.updateInstrumentSelector();
                    this.updateVolumeSlider();
                    this.saveState(); // Save state after removing track
                });
                tab.appendChild(removeBtn);
            }
            tabBar.appendChild(tab);
        });
        // Add Track button
        const addBtn = document.createElement('button');
        addBtn.className = 'add-track-btn';
        addBtn.textContent = '+ Add Track';
        addBtn.addEventListener('click', () => {
            this.song.tracks.push({ instrument: 0, notes: {}, volume: 100 });
            this.currentTrackIndex = this.song.tracks.length - 1;
            this.generateNoteGrid();
            this.restoreNoteVisuals();
            this.renderTrackTabs();
            this.updateInstrumentSelector();
            this.updateVolumeSlider();
            this.saveState(); // Save state after adding track
        });
        tabBar.appendChild(addBtn);
    }

    // Add a method to update the instrument selector to match the current track
    updateInstrumentSelector() {
        const selector = document.getElementById('instrumentSelector');
        if (!selector) return;
        const track = this.song.tracks[this.currentTrackIndex];
        selector.value = track.instrument;
    }

    setupEventListeners() {
        const gridContainer = document.getElementById('gridContainer');
        
        // Initialize audio context on first user interaction
        const initAudioContext = async () => {
            // Prevent multiple simultaneous initializations
            if (this.audioInitializing) {
                return;
            }
            
            if (!this.audioContext) {
                this.audioInitializing = true;
                try {
                    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    await this.loadInstrumentSounds(); // Wait for sounds to load
                    // Hide the audio notice once audio is initialized
                    const audioNotice = document.getElementById('audioNotice');
                    if (audioNotice) {
                        audioNotice.style.display = 'none';
                    }
                } finally {
                    this.audioInitializing = false;
                }
            } else if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
        };
        
        // Mouse events for desktop
        gridContainer.addEventListener('mousedown', async (e) => {
            await initAudioContext(); // Initialize audio context on first interaction
            if (e.target.classList.contains('note-cell')) {
                this.isDragging = true;
                this.toggleNote(e.target);
                
                const initialState = e.target.classList.contains('active');
                
                const dragHandler = (e) => {
                    const targetCell = document.elementFromPoint(e.clientX, e.clientY);
                    if (targetCell && targetCell.classList.contains('note-cell')) {
                        this.toggleNote(targetCell, initialState);
                    }
                };
                
                document.addEventListener('mousemove', dragHandler);
                document.addEventListener('mouseup', () => {
                    this.isDragging = false;
                    document.removeEventListener('mousemove', dragHandler);
                }, { once: true });
            }
        });

        // Touch events for mobile
        gridContainer.addEventListener('touchstart', async (e) => {
            e.preventDefault();
            await initAudioContext(); // Initialize audio context on first interaction
            const touch = e.touches[0];
            const targetCell = document.elementFromPoint(touch.clientX, touch.clientY);
            if (targetCell && targetCell.classList.contains('note-cell')) {
                this.isDragging = true;
                this.toggleNote(targetCell);
                
                const initialState = targetCell.classList.contains('active');
                
                const touchMoveHandler = (e) => {
                    e.preventDefault();
                    const touch = e.touches[0];
                    const targetCell = document.elementFromPoint(touch.clientX, touch.clientY);
                    if (targetCell && targetCell.classList.contains('note-cell')) {
                        this.toggleNote(targetCell, initialState);
                    }
                };
                
                const touchEndHandler = () => {
                    this.isDragging = false;
                    document.removeEventListener('touchmove', touchMoveHandler);
                    document.removeEventListener('touchend', touchEndHandler);
                };
                
                document.addEventListener('touchmove', touchMoveHandler, { passive: false });
                document.addEventListener('touchend', touchEndHandler);
            }
        }, { passive: false });

        // Transport controls
        document.getElementById('playBtn').addEventListener('click', async () => {
            await initAudioContext();
            this.play();
        });
        
        // Audio notice - scroll to piano roll
        const audioNotice = document.getElementById('audioNotice');
        if (audioNotice) {
            audioNotice.addEventListener('click', async () => {
                await initAudioContext();
                // Scroll to piano roll
                const pianoRoll = document.querySelector('.piano-roll');
                if (pianoRoll) {
                    pianoRoll.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'start' 
                    });
                }
            });
        }
        document.getElementById('pauseBtn').addEventListener('click', () => this.pause());
        document.getElementById('stopBtn').addEventListener('click', () => this.stop());
        document.getElementById('clearBtn').addEventListener('click', () => this.clear());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportSong());
        document.getElementById('importBtn').addEventListener('click', () => this.importSong());
        document.getElementById('fullViewBtn').addEventListener('click', () => this.toggleFullView());
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('redoBtn').addEventListener('click', () => this.redo());
        
        // Settings
        document.getElementById('instrumentSelector').addEventListener('change', (e) => {
            const track = this.song.tracks[this.currentTrackIndex];
            track.instrument = parseInt(e.target.value);
            this.renderTrackTabs(); // Update tab label if instrument changes
            this.generateNoteGrid(); // Regenerate grid with new note range
            this.saveState(); // Save state after changing instrument
        });

        document.getElementById('volumeSlider').addEventListener('input', (e) => {
            const track = this.song.tracks[this.currentTrackIndex];
            track.volume = parseInt(e.target.value);
            document.getElementById('volumeValue').textContent = `${track.volume}%`;
        });

        document.getElementById('tempoSlider').addEventListener('input', (e) => {
            this.song.tempo = parseInt(e.target.value);
            document.getElementById('tempoInput').value = this.song.tempo;
            if (this.isPlaying) {
                this.pause();
                this.play();
            }
        });

        document.getElementById('tempoInput').addEventListener('input', (e) => {
            const newTempo = parseInt(e.target.value);
            if (newTempo >= 20 && newTempo <= 600) {
                this.song.tempo = newTempo;
                document.getElementById('tempoSlider').value = this.song.tempo;
                if (this.isPlaying) {
                    this.pause();
                    this.play();
                }
            }
        });
        
        // Resume audio context on first interaction
        document.addEventListener('click', () => {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
        }, { once: true });
        
        // Add scroll event listener to sync playhead with manual scrolling
        const pianoRoll = document.querySelector('.piano-roll');
        if (pianoRoll) {
            let scrollTimeout;
            let isUserScrolling = false;
            
            pianoRoll.addEventListener('scroll', () => {
                // Mark that user is scrolling
                isUserScrolling = true;
                
                // Clear previous timeout
                clearTimeout(scrollTimeout);
                
                // Set a timeout to update playhead position after scrolling stops
                // Only update if not currently playing to maintain consistent BPM
                scrollTimeout = setTimeout(() => {
                    if (!this.isPlaying) {
                        this.updatePlayheadFromScroll();
                    }
                    isUserScrolling = false;
                }, 100);
            });
            
            // Store the scrolling state for use in syncScrollbarWithPlayhead
            this.isUserScrolling = () => isUserScrolling;
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Undo: Ctrl+Z or Cmd+Z
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            }
            // Redo: Ctrl+Y or Cmd+Shift+Z
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                this.redo();
            }
            // Space to play/pause
            if (e.code === 'Space' && !e.target.matches('input, textarea')) {
                e.preventDefault();
                if (this.isPlaying) {
                    this.pause();
                } else {
                    this.play();
                }
            }
            // Escape to stop
            if (e.code === 'Escape') {
                this.stop();
            }
        });
    }

    // Add this method to the NBSEditor class
    exportSong() {
        // Create a new NBS song
        const nbsSong = new Song();
        // Set song metadata
        nbsSong.name = this.song.name;
        nbsSong.author = this.song.author;
        nbsSong.originalAuthor = this.song.originalAuthor;
        nbsSong.description = this.song.description;
        nbsSong.tempo = (this.song.tempo * 4) / 60; // Convert BPM to ticks per second
        nbsSong.timeSignature = this.song.timeSignature;
        nbsSong.size = this.totalTicks;
        // Create a layer for each track and add notes
        this.song.tracks.forEach((track, trackIdx) => {
            const layer = nbsSong.addLayer();
            // Set layer name to instrument name for better identification
            layer.name = this.instruments[track.instrument]?.name || `Track ${trackIdx + 1}`;
            for (const key in track.notes) {
                const [noteIndex, tick] = key.split(',').map(Number);
                const noteData = track.notes[key];
                // Map note index to Minecraft key (F#3 to F#5 = keys 33-57)
                const minecraftKey = 33 + noteIndex;
                const instrument = nbsSong.instruments[track.instrument];
                // Create the note
                const note = layer.setNote(tick, minecraftKey, instrument);
                // Set additional properties (NBS v4+)
                note.velocity = 100; // Default volume
                note.panning = 100; // Center position
                note.pitch = 0; // No pitch bend
            }
        });
        // Convert to ArrayBuffer
        const arrayBuffer = Song.toArrayBuffer(nbsSong);
        // Create and download the file
        const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.song.name.replace(/[^a-z0-9]/gi, '_')}.nbs`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Add import functionality
    importSong() {
        // Create a file input element
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.nbs';
        fileInput.style.display = 'none';
        
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    const nbsSong = Song.fromArrayBuffer(arrayBuffer);
                    
                    // Convert NBS song to editor format
                    this.loadSongFromNBS(nbsSong);
                    
                    // Clean up
                    document.body.removeChild(fileInput);
                } catch (error) {
                    console.error('Error importing NBS file:', error);
                    
                    // Provide more specific error messages
                    let errorMessage = 'Error importing NBS file. ';
                    if (error.message.includes('Unexpected end of file')) {
                        errorMessage += 'The file appears to be corrupted or incomplete.';
                    } else if (error.message.includes('Invalid string length')) {
                        errorMessage += 'The file format is not recognized as a valid NBS file.';
                    } else if (error.message.includes('Failed to parse NBS file')) {
                        errorMessage += 'The file format is not supported or corrupted.';
                    } else {
                        errorMessage += 'Please make sure it\'s a valid NBS file.';
                    }
                    
                    // Use console.log instead of alert for sandboxed environments
                    console.log(errorMessage);
                    
                    // Try to show a more user-friendly error
                    const audioNotice = document.getElementById('audioNotice');
                    if (audioNotice) {
                        audioNotice.innerHTML = `<p>${errorMessage}</p>`;
                        audioNotice.style.display = 'block';
                        audioNotice.style.background = '#e74c3c';
                        audioNotice.style.borderColor = '#c0392b';
                        
                        // Hide the error after 5 seconds
                        setTimeout(() => {
                            audioNotice.style.display = 'none';
                        }, 5000);
                    }
                    
                    document.body.removeChild(fileInput);
                }
            };
            
            reader.onerror = () => {
                alert('Error reading file.');
                document.body.removeChild(fileInput);
            };
            
            reader.readAsArrayBuffer(file);
        });
        
        // Trigger file selection
        document.body.appendChild(fileInput);
        fileInput.click();
    }

    loadSongFromNBS(nbsSong) {
        console.log('=== NBS Import Debug ===');
        console.log('NBS Song object:', nbsSong);
        console.log('NBS Song layers:', nbsSong.layers);
        console.log('NBS Song instruments:', nbsSong.instruments);
        
        // Update song metadata
        this.song.name = nbsSong.name || 'Imported Song';
        this.song.author = nbsSong.author || 'Unknown';
        this.song.originalAuthor = nbsSong.originalAuthor || '';
        this.song.description = nbsSong.description || '';
        
        // Convert NBS tempo (ticks per second) to BPM
        // NBS uses 4 ticks per beat, so: BPM = (ticks per second * 60) / 4
        let calculatedBPM = (nbsSong.tempo * 60) / 4;
        
        // Limit BPM to reasonable range (20-300 BPM)
        if (calculatedBPM < 20) {
            console.warn('BPM too slow, limiting to 20 BPM');
            calculatedBPM = 20;
        } else if (calculatedBPM >= 300) {
            console.warn('BPM too fast, limiting to 300 BPM');
            calculatedBPM = 300;
        }
        
        this.song.tempo = Math.round(calculatedBPM);
        this.song.timeSignature = nbsSong.timeSignature || 4;
        
        console.log('Original NBS tempo (ticks per second):', nbsSong.tempo);
        console.log('Calculated BPM (before limit):', (nbsSong.tempo * 60) / 4);
        console.log('Final BPM (after limit):', this.song.tempo);
        console.log('Original song size (ticks):', nbsSong.size);
        console.log('Song duration (seconds):', (nbsSong.size / 4) / (this.song.tempo / 60));
        console.log('Song duration (minutes):', ((nbsSong.size / 4) / (this.song.tempo / 60)) / 60);
        
        // Update UI elements
        document.getElementById('songName').value = this.song.name;
        document.getElementById('songAuthor').value = this.song.author;
        document.getElementById('originalAuthor').value = this.song.originalAuthor;
        document.getElementById('songDescription').value = this.song.description;
        document.getElementById('tempoSlider').value = this.song.tempo;
        document.getElementById('tempoInput').value = this.song.tempo;
        document.getElementById('tempoValue').textContent = 'BPM';
        
        // Clear existing tracks
        this.song.tracks = [];
        
        console.log('Processing', nbsSong.layers.length, 'layers...');
        
        // Convert layers to tracks
        nbsSong.layers.forEach((layer, layerIndex) => {
            console.log(`Processing layer ${layerIndex}:`, layer);
            console.log(`Layer notes:`, layer.notes);
            
            const track = {
                instrument: layer.instrument?.id || 0,
                notes: {},
                volume: Math.round(layer.volume * 100)
            };
            
            console.log(`Track ${layerIndex} instrument:`, track.instrument);
            console.log(`Track ${layerIndex} volume:`, track.volume);
            
            // Convert notes from NBS format to editor format
            let noteCount = 0;
            for (const tick in layer.notes) {
                const note = layer.notes[tick];
                console.log(`Layer ${layerIndex}, Tick ${tick}, Note:`, note);
                
                if (note) {
                    // Convert Minecraft key (33-57) to note index (0-24)
                    const noteIndex = Math.max(0, Math.min(24, note.key - 33));
                    const noteKey = `${noteIndex},${tick}`;
                    
                    console.log(`Converting note: key=${note.key}, noteIndex=${noteIndex}, noteKey=${noteKey}`);
                    
                    track.notes[noteKey] = {
                        instrument: note.instrument?.id || 0,
                        pitch: noteIndex
                    };
                    noteCount++;
                }
            }
            
            console.log(`Track ${layerIndex} has ${noteCount} notes:`, track.notes);
            this.song.tracks.push(track);
        });
        
        console.log('Total tracks created:', this.song.tracks.length);
        console.log('All tracks:', this.song.tracks);
        
        // If no tracks were created, add a default one
        if (this.song.tracks.length === 0) {
            console.warn('No tracks created, adding default track');
            this.song.tracks.push({
                instrument: 0,
                notes: {},
                volume: 100
            });
        }
        
        // Update total ticks based on song size
        let songLength = Math.max(64, nbsSong.size);
        
        // Find the highest and lowest tick positions that have notes
        let maxTickWithNotes = 0;
        let minTickWithNotes = Infinity;
        let allTicks = [];
        
        console.log('=== Tick Analysis Debug ===');
        for (const track of this.song.tracks) {
            console.log('Analyzing track notes:', track.notes);
            for (const key in track.notes) {
                const [, tick] = key.split(',').map(Number);
                maxTickWithNotes = Math.max(maxTickWithNotes, tick);
                minTickWithNotes = Math.min(minTickWithNotes, tick);
                allTicks.push(tick);
                console.log(`Found note at tick: ${tick}`);
            }
        }
        
        console.log('All tick positions found:', allTicks.sort((a, b) => a - b));
        console.log('Min tick with notes:', minTickWithNotes);
        console.log('Max tick with notes:', maxTickWithNotes);
        console.log('Tick range:', maxTickWithNotes - minTickWithNotes + 1);
        console.log('=== End Tick Analysis ===');
        
        // Use the maximum of song size or highest tick with notes
        songLength = Math.max(songLength, maxTickWithNotes + 1);
        
        console.log('Original NBS size:', nbsSong.size);
        console.log('Max tick with notes:', maxTickWithNotes);
        console.log('Calculated song length:', songLength);
        
        // Limit song length to reasonable range (max 1000 ticks for better performance)
        if (songLength > 1000) {
            console.warn('Song too long, limiting to 1000 ticks');
            songLength = 1000;
        }
        
        this.totalTicks = songLength;
        console.log('Final totalTicks:', this.totalTicks);
        console.log('Grid will have', this.totalTicks, 'columns');
        console.log('Grid width will be', this.totalTicks * 25, 'pixels');
        
        // Reset current track index
        this.currentTrackIndex = 0;
        
        console.log('About to generate note grid...');
        
        // Update UI
        this.generateNoteGrid();
        this.renderTrackTabs();
        this.updateInstrumentSelector();
        this.updateVolumeSlider();
        
        // Restore note visuals after grid generation
        this.restoreNoteVisuals();
        
        // Save state
        this.saveState();
        
        console.log(`Imported song: ${this.song.name} with ${this.song.tracks.length} tracks, tempo: ${this.song.tempo} BPM`);
        console.log('=== End NBS Import Debug ===');
    }

    // Add a helper to play a note with a specific instrument
    playNoteWithInstrument(noteIndex, instrumentId, time = 0) {
        // Ensure audio context is initialized and ready
        if (!this.audioContext || this.audioContext.state === 'suspended') {
            console.warn('Audio context not ready, skipping note playback');
            return;
        }
        
        const source = this.audioContext.createBufferSource();
        
        // Get buffer, create fallback if not available
        let buffer = this.buffers.get(instrumentId);
        if (!buffer) {
            buffer = this.createSynthBuffer(instrumentId);
            this.buffers.set(instrumentId, buffer);
        }
        
        source.buffer = buffer;
        const semitones = noteIndex - 12;
        source.playbackRate.value = Math.pow(2, semitones / 12);
        
        // Create a gain node for volume control
        const gainNode = this.audioContext.createGain();
        const track = this.song.tracks[this.currentTrackIndex];
        gainNode.gain.value = track.volume / 100; // Convert percentage to 0-1 range
        
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        source.start(this.audioContext.currentTime + time);
    }

    // Add a helper to play a note with a specific instrument and volume
    playNoteWithTrackVolume(noteIndex, instrumentId, volume, time = 0) {
        // Ensure audio context is initialized and ready
        if (!this.audioContext || this.audioContext.state === 'suspended') {
            console.warn('Audio context not ready, skipping note playback');
            return;
        }
        
        const source = this.audioContext.createBufferSource();
        
        // Get buffer, create fallback if not available
        let buffer = this.buffers.get(instrumentId);
        if (!buffer) {
            buffer = this.createSynthBuffer(instrumentId);
            this.buffers.set(instrumentId, buffer);
        }
        
        source.buffer = buffer;
        const semitones = noteIndex - 12;
        source.playbackRate.value = Math.pow(2, semitones / 12);
        
        // Create a gain node for volume control
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = volume / 100; // Convert percentage to 0-1 range
        
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        source.start(this.audioContext.currentTime + time);
    }

    toggleFullView() {
        this.fullViewMode = !this.fullViewMode;
        const btn = document.getElementById('fullViewBtn');
        btn.textContent = this.fullViewMode ? '👁️ Track View' : '👁️ Full View';
        this.generateNoteGrid();
    }

    // Get note range for a specific instrument
    getNoteRangeForInstrument(instrumentId) {
        const instrument = this.instruments[instrumentId];
        if (!instrument) return this.noteNames;
        
        const range = instrument.range;
        if (range === "—") {
            // Drums/percussion - only one note
            return ["Drum"];
        }
        
        // Parse range like "F♯3–F♯5" or "F♯1–F♯3"
        const [startNote, endNote] = range.split("–");
        
        // Define the chromatic scale
        const chromaticScale = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
        
        // Parse start note
        const startNoteName = startNote.slice(0, -1); // "F♯"
        const startOctave = parseInt(startNote.slice(-1)); // 3
        
        // Parse end note
        const endNoteName = endNote.slice(0, -1); // "F♯"
        const endOctave = parseInt(endNote.slice(-1)); // 5
        
        // Find indices in chromatic scale
        const startIndex = chromaticScale.indexOf(startNoteName);
        const endIndex = chromaticScale.indexOf(endNoteName);
        
        const notes = [];
        let currentOctave = startOctave;
        let currentIndex = startIndex;
        
        while (true) {
            const noteName = chromaticScale[currentIndex];
            const note = `${noteName}${currentOctave}`;
            notes.push(note);
            
            // Check if we've reached the end note
            if (note === endNote) {
                break;
            }
            
            // Move to next note
            currentIndex = (currentIndex + 1) % 12;
            if (currentIndex === 0) {
                currentOctave++;
            }
        }
        
        return notes;
    }
    
    // Get note names for current instrument
    getCurrentNoteNames() {
        const track = this.song.tracks[this.currentTrackIndex];
        return this.getNoteRangeForInstrument(track.instrument);
    }

    // Restore visual state of notes after grid regeneration
    restoreNoteVisuals() {
        console.log('=== Restore Note Visuals Debug ===');
        const track = this.song.tracks[this.currentTrackIndex];
        console.log('Current track index:', this.currentTrackIndex);
        console.log('Current track:', track);
        console.log('Track notes:', track.notes);
        console.log('Number of notes to restore:', Object.keys(track.notes).length);
        
        // Also show overall song statistics
        console.log('=== Overall Song Statistics ===');
        console.log('Total tracks:', this.song.tracks.length);
        let overallEarliestTick = Infinity;
        let overallLatestTick = 0;
        let totalNotes = 0;
        
        this.song.tracks.forEach((t, idx) => {
            const trackNotes = Object.keys(t.notes).length;
            totalNotes += trackNotes;
            console.log(`Track ${idx}: ${trackNotes} notes`);
            
            Object.entries(t.notes).forEach(([key, note]) => {
                const [, tick] = key.split(',').map(Number);
                overallEarliestTick = Math.min(overallEarliestTick, tick);
                overallLatestTick = Math.max(overallLatestTick, tick);
            });
        });
        
        console.log('Overall earliest tick:', overallEarliestTick);
        console.log('Overall latest tick:', overallLatestTick);
        console.log('Total notes across all tracks:', totalNotes);
        console.log('=== End Overall Song Statistics ===');
        
        // Find earliest and latest notes
        let earliestTick = Infinity;
        let latestTick = 0;
        let allTicks = [];
        
        Object.entries(track.notes).forEach(([key, note]) => {
            const [noteIndex, tick] = key.split(',').map(Number);
            earliestTick = Math.min(earliestTick, tick);
            latestTick = Math.max(latestTick, tick);
            allTicks.push(tick);
        });
        
        console.log('Earliest tick in track:', earliestTick);
        console.log('Latest tick in track:', latestTick);
        console.log('All ticks in track:', allTicks.sort((a, b) => a - b));
        
        let restoredCount = 0;
        Object.entries(track.notes).forEach(([key, note]) => {
            const [noteIndex, tick] = key.split(',').map(Number);
            console.log(`Looking for note: noteIndex=${noteIndex}, tick=${tick}`);
            
            const cell = document.querySelector(`.note-cell[data-note="${noteIndex}"][data-tick="${tick}"]`);
            console.log(`Found cell:`, cell);
            
            if (cell) {
                cell.classList.add('active');
                cell.style.backgroundColor = this.instruments[track.instrument]?.color || '';
                restoredCount++;
                console.log(`Restored note at ${noteIndex},${tick}`);
            } else {
                console.warn(`Could not find cell for note at ${noteIndex},${tick}`);
            }
        });
        
        console.log(`Restored ${restoredCount} notes out of ${Object.keys(track.notes).length}`);
        console.log('=== End Restore Note Visuals Debug ===');
    }



    // Add a method to update the volume slider to match the current track
    updateVolumeSlider() {
        const slider = document.getElementById('volumeSlider');
        const value = document.getElementById('volumeValue');
        if (!slider || !value) return;
        const track = this.song.tracks[this.currentTrackIndex];
        slider.value = track.volume;
        value.textContent = `${track.volume}%`;
    }

    // Undo/Redo methods
    saveState() {
        // Create a deep copy of the current song state
        const state = JSON.parse(JSON.stringify(this.song));
        
        // Remove any future history if we're not at the end
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        // Add new state to history
        this.history.push(state);
        
        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
        
        this.updateUndoRedoButtons();
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex]);
            this.updateUndoRedoButtons();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
            this.updateUndoRedoButtons();
        }
    }

    restoreState(state) {
        this.song = JSON.parse(JSON.stringify(state));
        this.generateNoteGrid();
        this.restoreNoteVisuals();
        this.renderTrackTabs();
        this.updateInstrumentSelector();
        this.updateVolumeSlider();
    }

    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        
        undoBtn.disabled = this.historyIndex <= 0;
        redoBtn.disabled = this.historyIndex >= this.history.length - 1;
    }
}

// Initialize NBSEditor as before
document.addEventListener('DOMContentLoaded', () => {
    const editor = new NBSEditor();
});
