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
        this.fullViewMode = true; // Track full view state - default to true
        this.audioInitializing = false; // Flag to prevent multiple simultaneous audio initializations
        
        // New features
        this.clipboard = null;
        this.selection = {
            start: null,
            end: null,
            active: false
        };
        this.isSelecting = false;
        
        // URL sharing and library features
        this.defaultSongs = []; // Will be loaded asynchronously
        this.sharedSongs = [];
        
        // Generate note names for range (F♯3 to F♯5 = notes 0-24)
        this.noteNames = [];
        const noteNames = ['F♯3', 'G3', 'G♯3', 'A3', 'A♯3', 'B3', 'C4', 'C♯4', 'D4', 'D♯4', 'E4', 'F4', 'F♯4',
                          'G4', 'G♯4', 'A4', 'A♯4', 'B4', 'C5', 'C♯5', 'D5', 'D♯5', 'E5', 'F5', 'F♯5'];
        for (let i = 0; i <= 24; i++) {
            this.noteNames[i] = noteNames[i] || `Note ${i}`;
        }

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
        
        // Setup new features
        this.setupKeyboardShortcuts();
        this.setupModalHandlers();
        this.setupLibraryHandlers();
        this.setupShareHandlers();
        this.setupGridSizeControl();
        this.updateStatusBar();
        
        // Load songs from assets/songs/ directory
        try {
            this.defaultSongs = await this.getDefaultSongs();
        } catch (error) {
            console.error('Error loading default songs:', error);
            this.defaultSongs = this.getFallbackSongs();
        }
        
        // Try to load song from URL
        if (!this.loadSongFromURL()) {
            // If no song in URL, load first available song
            if (this.defaultSongs.length > 0) {
                this.loadSongData(this.defaultSongs[0].data);
            } else {
                // Fallback to a basic empty song
                this.loadSongData({
                    name: "New Song",
                    author: "Player",
                    originalAuthor: "",
                    description: "",
                    tempo: 120,
                    timeSignature: 4,
                    length: 64,
                    tracks: [{
                        instrument: 0,
                        notes: {},
                        volume: 100
                    }]
                });
            }
        }
        

        
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
        // Prevent multiple calls in quick succession
        if (this._generatingGrid) {
            console.log('Skipping generateNoteGrid - already in progress');
            return;
        }
        
        this._generatingGrid = true;
        
        try {
            
            
            const gridContainer = document.getElementById('gridContainer');
            const noteLabels = document.querySelector('.piano-keys');
            const tickLabels = document.querySelector('.tick-labels');
            
            noteLabels.innerHTML = '';
            tickLabels.innerHTML = '';
            gridContainer.innerHTML = '';
        
        // Use the full song length for the visual grid
        const visualTicks = this.totalTicks;
        
        // Update CSS custom property for song length
        document.documentElement.style.setProperty('--song-length', visualTicks);
        
        // Analyze the song to find the actual note range used
        let minNote = 24; // Start with highest possible note (F♯5)
        let maxNote = 0;  // Start with lowest possible note (F♯3)
        let hasNotes = false;
        
        if (this.fullViewMode) {
            // In full view, check all tracks for notes
            for (let trackIndex = 0; trackIndex < this.song.tracks.length; trackIndex++) {
                const track = this.song.tracks[trackIndex];
                
                for (const key in track.notes) {
                    const [noteIndex] = key.split(',').map(Number);
                    
                    if (noteIndex >= 0 && noteIndex <= 24) {
                        minNote = Math.min(minNote, noteIndex);
                        maxNote = Math.max(maxNote, noteIndex);
                        hasNotes = true;
                    }
                }
            }
        } else {
            // In track view, only check current track
            const track = this.song.tracks[this.currentTrackIndex];
            
            for (const key in track.notes) {
                const [noteIndex] = key.split(',').map(Number);
                
                if (noteIndex >= 0 && noteIndex <= 24) {
                    minNote = Math.min(minNote, noteIndex);
                    maxNote = Math.max(maxNote, noteIndex);
                    hasNotes = true;
                }
            }
        }
        
        // If no notes found OR in full view mode, use full Minecraft Note Block range
        if (!hasNotes || this.fullViewMode) {
            minNote = 0;  // F♯3
            maxNote = 24; // F♯5
        }
        
        // Add some padding to the range (but not in full view mode)
        if (!this.fullViewMode) {
            minNote = Math.max(0, minNote - 2);
            maxNote = Math.min(24, maxNote + 2);
        }
        
        const noteRange = maxNote - minNote + 1;
        
        // Update CSS custom property for note range
        document.documentElement.style.setProperty('--note-range', noteRange);
        
        // Generate tick labels
        for (let tick = 0; tick < visualTicks; tick++) {
            const tickLabel = document.createElement('div');
            tickLabel.className = 'tick-label';
            tickLabel.textContent = tick;
            tickLabels.appendChild(tickLabel);
        }
        
        // Generate note labels
        const noteNames = this.getCurrentNoteNames();
        
        for (let i = minNote; i <= maxNote; i++) {
            const label = document.createElement('div');
            label.className = 'note-label';
            const noteName = noteNames[i] || `Note ${i}`;
            label.textContent = noteName;
            label.dataset.note = i;
            noteLabels.appendChild(label);
        }
        
        // Generate grid cells
        let cellCount = 0;
        for (let i = minNote; i <= maxNote; i++) {
            for (let tick = 0; tick < visualTicks; tick++) {
                const cell = document.createElement('div');
                cell.className = 'note-cell';
                cell.dataset.note = i;
                cell.dataset.tick = tick;
                gridContainer.appendChild(cell);
                cellCount++;
            }
        }
        

        
        this.restoreNoteVisuals();
        
        // Show warning if any notes are outside the displayed range
        this.checkForNotesOutsideRange();
        
        // Add a button to expand the view if notes are outside range
        this.addExpandViewButton();
        

        } finally {
            // Clear the flag after a short delay to prevent rapid successive calls
            setTimeout(() => {
                this._generatingGrid = false;
            }, 100);
        }
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
        
        // Check if there's already a note from a different track in full view mode
        if (this.fullViewMode) {
            const existingTrackIndex = cell.dataset.trackIndex;
            if (existingTrackIndex && parseInt(existingTrackIndex) !== this.currentTrackIndex) {
                // In full view mode, show which track owns this note
                console.log(`Note at ${noteIndex},${tick} belongs to track ${existingTrackIndex}, not current track ${this.currentTrackIndex}`);
                // Don't allow editing notes from other tracks in full view mode
                return;
            }
        }
        
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
                        existingCell.removeAttribute('data-track-index');
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
            cell.dataset.trackIndex = this.currentTrackIndex;
            this.playNote(noteIndex, track.instrument);
            this.saveState();
        } else {
            delete track.notes[noteKey];
            cell.classList.remove('active');
            cell.style.backgroundColor = '';
            cell.removeAttribute('data-track-index');
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
        
        // If the song has finished (currentTick >= totalTicks), start from the beginning
        if (this.currentTick >= this.totalTicks) {
            this.currentTick = 0;
        }
        
        this.isPlaying = true;
        document.getElementById('playBtn').disabled = true;
        document.getElementById('pauseBtn').disabled = false;
        document.getElementById('stopBtn').disabled = false;
        
        // Show playhead when playing
        document.getElementById('playhead').style.display = 'block';
        
        // Calculate tick duration in seconds (not milliseconds for audio scheduling)
        const tickDuration = (60 / this.song.tempo) / 4; // seconds per tick
        
        // DEBUG: Log initial timing parameters
        console.log(`DEBUG: Starting playback - Tempo: ${this.song.tempo} BPM, Tick duration: ${(tickDuration * 1000).toFixed(2)}ms, Current tick: ${this.currentTick}`);
        
        // Store start time for precise timing using audio context time
        this.playStartTime = this.audioContext.currentTime;
        this.playStartTick = this.currentTick;
        
        // DEBUG: Log start times
        console.log(`DEBUG: Play start time: ${this.playStartTime}s, Start tick: ${this.playStartTick}`);
        
        // DEBUG: Monitor audio context state
        this.monitorAudioContextState();
        
        // Initialize scheduling variables
        this.nextTickTime = this.playStartTime;
        this.scheduleAheadTime = 0.1; // Schedule 100ms ahead
        this.schedulerInterval = 10; // Check every 10ms for more responsive updates
        
        // Start the scheduler
        this.scheduler();
        
        this.updatePlayhead();
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
        
        // Sync scrollbar with playhead position (but less frequently to avoid jitter)
        if (this.currentTick % 4 === 0) { // Only auto-scroll every 4 ticks
            this.syncScrollbarWithPlayhead();
        }
        
        this.updateStatusBar();
    }
    
    syncScrollbarWithPlayhead() {
        const pianoRoll = document.querySelector('.piano-roll');
        if (!pianoRoll) return;
        
        // Don't auto-scroll if user is manually scrolling
        if (this.isUserScrolling && this.isUserScrolling()) {
            console.log(`DEBUG: Auto-scroll skipped - user is manually scrolling`);
            return;
        }
        
        // Don't auto-scroll if not playing (to avoid interference with manual positioning)
        if (!this.isPlaying) {
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
        
        // DEBUG: Log auto-scroll calculations every 20 ticks to avoid spam
        if (this.currentTick % 20 === 0) {
            console.log(`DEBUG: Auto-scroll - Tick: ${this.currentTick}, Playhead center: ${playheadCenter}px, Scroll left: ${scrollLeft}px, Piano roll width: ${pianoRollWidth}px`);
        }
        
        // Apply smooth scrolling to the piano roll
        pianoRoll.scrollTo({
            left: Math.max(0, scrollLeft),
            behavior: 'smooth'
        });
    }
    
    updatePlayheadFromScroll() {
        const pianoRoll = document.querySelector('.piano-roll');
        if (!pianoRoll) return;
        
        // Don't update playhead position during playback to maintain consistent BPM
        if (this.isPlaying) {
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
        }
    }



    pause() {
        console.log(`DEBUG: Pause called - Current tick: ${this.currentTick}, isPlaying: ${this.isPlaying}`);
        this.isPlaying = false;
        // Clear any scheduled timeouts
        if (this.schedulerTimeout) {
            clearTimeout(this.schedulerTimeout);
            this.schedulerTimeout = null;
        }
        document.getElementById('playBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
        // Hide playhead when paused
        document.getElementById('playhead').style.display = 'none';
    }

    stop() {
        console.log(`DEBUG: Stop called - Current tick: ${this.currentTick}, isPlaying: ${this.isPlaying}`);
        this.isPlaying = false;
        // Clear any scheduled timeouts
        if (this.schedulerTimeout) {
            clearTimeout(this.schedulerTimeout);
            this.schedulerTimeout = null;
        }
        this.currentTick = 0;
        document.getElementById('playBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
        document.getElementById('stopBtn').disabled = true;
        // Hide playhead when stopped
        document.getElementById('playhead').style.display = 'none';
        this.updatePlayhead();
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
                this.updateStatusBar();
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
            this.updateStatusBar();
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
                // Check if Ctrl/Cmd is held for selection mode
                if (e.ctrlKey || e.metaKey) {
                    this.startSelection(e);
                } else {
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
        document.getElementById('copyBtn').addEventListener('click', () => this.copySelection());
        document.getElementById('pasteBtn').addEventListener('click', () => this.pasteSelection());
        
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
            this.saveState(); // Save state when volume changes
        });

        document.getElementById('tempoSlider').addEventListener('input', (e) => {
            const oldTempo = this.song.tempo;
            this.song.tempo = parseInt(e.target.value);
            document.getElementById('tempoInput').value = this.song.tempo;
            console.log(`DEBUG: Tempo changed from ${oldTempo} to ${this.song.tempo} BPM`);
            if (this.isPlaying) {
                console.log(`DEBUG: Restarting playback due to tempo change`);
                this.pause();
                this.play();
            }
        });

        document.getElementById('tempoInput').addEventListener('input', (e) => {
            const newTempo = parseInt(e.target.value);
            if (newTempo >= 20 && newTempo <= 600) {
                const oldTempo = this.song.tempo;
                this.song.tempo = newTempo;
                document.getElementById('tempoSlider').value = this.song.tempo;
                console.log(`DEBUG: Tempo changed from ${oldTempo} to ${this.song.tempo} BPM`);
                if (this.isPlaying) {
                    console.log(`DEBUG: Restarting playback due to tempo change`);
                    this.pause();
                    this.play();
                }
            }
        });
        
        // Song info field synchronization
        const songInfoFields = [
            { desktop: 'songName', mobile: 'songNameMobile' },
            { desktop: 'songAuthor', mobile: 'songAuthorMobile' },
            { desktop: 'originalAuthor', mobile: 'originalAuthorMobile' },
            { desktop: 'songDescription', mobile: 'songDescriptionMobile' }
        ];
        
        songInfoFields.forEach(field => {
            const desktopEl = document.getElementById(field.desktop);
            const mobileEl = document.getElementById(field.mobile);
            
            if (desktopEl) {
                desktopEl.addEventListener('input', (e) => {
                    // Sync to mobile field
                    if (mobileEl) {
                        mobileEl.value = e.target.value;
                    }
                    // Update song object
                    const fieldName = field.desktop.replace('song', '').toLowerCase();
                    if (fieldName === 'name') {
                        this.song.name = e.target.value;
                    } else if (fieldName === 'author') {
                        this.song.author = e.target.value;
                    } else if (fieldName === 'originalauthor') {
                        this.song.originalAuthor = e.target.value;
                    } else if (fieldName === 'description') {
                        this.song.description = e.target.value;
                    }
                });
            }
            
            if (mobileEl) {
                mobileEl.addEventListener('input', (e) => {
                    // Sync to desktop field
                    if (desktopEl) {
                        desktopEl.value = e.target.value;
                    }
                    // Update song object
                    const fieldName = field.desktop.replace('song', '').toLowerCase();
                    if (fieldName === 'name') {
                        this.song.name = e.target.value;
                    } else if (fieldName === 'author') {
                        this.song.author = e.target.value;
                    } else if (fieldName === 'originalauthor') {
                        this.song.originalAuthor = e.target.value;
                    } else if (fieldName === 'description') {
                        this.song.description = e.target.value;
                    }
                });
            }
        });
        
        // Resume audio context on first interaction
        document.addEventListener('click', () => {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                console.log(`DEBUG: Resuming suspended audio context`);
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
                console.log(`DEBUG: User scrolling detected - tick: ${this.currentTick}, isPlaying: ${this.isPlaying}`);
                
                // Clear previous timeout
                clearTimeout(scrollTimeout);
                
                // Set a timeout to update playhead position after scrolling stops
                // Only update if not currently playing to maintain consistent BPM
                scrollTimeout = setTimeout(() => {
                    if (!this.isPlaying) {
                        console.log(`DEBUG: User scrolling stopped - updating playhead position`);
                        this.updatePlayheadFromScroll();
                    } else {
                        console.log(`DEBUG: User scrolling stopped - skipping playhead update (playing)`);
                    }
                    isUserScrolling = false;
                    console.log(`DEBUG: User scrolling state cleared`);
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
    updateSongInfoFields() {
        // Update both desktop and mobile song info fields
        const fields = [
            { desktop: 'songName', mobile: 'songNameMobile', songProp: 'name' },
            { desktop: 'songAuthor', mobile: 'songAuthorMobile', songProp: 'author' },
            { desktop: 'originalAuthor', mobile: 'originalAuthorMobile', songProp: 'originalAuthor' },
            { desktop: 'songDescription', mobile: 'songDescriptionMobile', songProp: 'description' }
        ];
        
        fields.forEach(field => {
            const desktopEl = document.getElementById(field.desktop);
            const mobileEl = document.getElementById(field.mobile);
            const value = this.song[field.songProp] || '';
            
            if (desktopEl) {
                desktopEl.value = value;
            }
            if (mobileEl) {
                mobileEl.value = value;
            }
        });
    }
    
    getSongInfoFromFields() {
        // Get song info from form fields (prefer desktop, fallback to mobile)
        const getFieldValue = (fieldName) => {
            const desktopEl = document.getElementById(fieldName);
            const mobileEl = document.getElementById(fieldName + 'Mobile');
            return (desktopEl && desktopEl.value) || (mobileEl && mobileEl.value) || '';
        };
        
        return {
            name: getFieldValue('songName'),
            author: getFieldValue('songAuthor'),
            originalAuthor: getFieldValue('originalAuthor'),
            description: getFieldValue('songDescription')
        };
    }
    
    exportSong() {
        // Get current song info from form fields
        const songInfo = this.getSongInfoFromFields();
        
        // Create a new NBS song
        const nbsSong = new Song();
        // Set song metadata
        nbsSong.name = songInfo.name;
        nbsSong.author = songInfo.author;
        nbsSong.originalAuthor = songInfo.originalAuthor;
        nbsSong.description = songInfo.description;
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
                // Use the note's individual instrument, not the track's instrument
                const noteInstrument = noteData.instrument;
                const instrument = nbsSong.instruments[noteInstrument];
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
        // Validate input
        if (!nbsSong || !nbsSong.layers) {
            console.error('Invalid NBS song data: missing layers property');
            return false;
        }

        // Convert NBS tempo (ticks per second) to BPM
        // NBS uses 4 ticks per beat, so: BPM = (ticks per second * 60) / 4
        let calculatedBPM = Math.round((nbsSong.tempo * 60) / 4);
        
        // Limit BPM to reasonable range (matching UI slider max)
        if (calculatedBPM < 20) {
            console.warn('BPM too slow, limiting to 20 BPM');
            calculatedBPM = 20;
        } else if (calculatedBPM >= 600) {
            console.warn('BPM too fast, limiting to 600 BPM');
            calculatedBPM = 600;
        }
        
        this.song.tempo = Math.round(calculatedBPM);
        this.song.timeSignature = nbsSong.timeSignature || 4;
        
        // Update UI elements
        this.updateSongInfoFields();
        document.getElementById('tempoSlider').value = this.song.tempo;
        document.getElementById('tempoInput').value = this.song.tempo;
        document.getElementById('tempoValue').textContent = 'BPM';
        
        // Clear existing tracks
        this.song.tracks = [];
        
        // Convert layers to tracks
        nbsSong.layers.forEach((layer, layerIndex) => {
            const track = {
                instrument: 0, // Default to harp, will be overridden by individual notes
                notes: {},
                volume: Math.round(layer.volume * 100)
            };
            
            // Convert notes from NBS format to editor format
            let noteCount = 0;
            
            for (const tick in layer.notes) {
                const note = layer.notes[tick];
                
                if (note) {
                    console.log(`=== NBS NOTE IMPORT DEBUG ===`);
                    console.log(`Original NBS note:`, note);
                    console.log(`Note key: ${note.key}, pitch: ${note.pitch}, tick: ${tick}`);
                    
                    // Convert NBS note to Minecraft Note Block range (0-24)
                    // NBS files have both key and pitch fields
                    // Based on NBS format, 'key' is typically the MIDI note number (0-127)
                    // and 'pitch' is usually a pitch bend value
                    let noteIndex = note.key;
                    
                    console.log(`Using noteIndex: ${noteIndex} (from key: ${note.key}, pitch: ${note.pitch})`);
                    
                    // Debug: Check if this is a valid note value
                    if (typeof noteIndex !== 'number' || noteIndex < 0 || noteIndex > 127) {
                        console.warn(`Invalid note value: ${noteIndex}`);
                        continue;
                    }
                    
                    // Map MIDI note numbers to Minecraft Note Block range (0-24)
                    // Minecraft Note Blocks range from F#3 (MIDI 42) to F#5 (MIDI 66)
                    // So we need to map MIDI notes 42-66 to our 0-24 range
                    if (noteIndex >= 42 && noteIndex <= 66) {
                        // Direct mapping from MIDI to Minecraft Note Block range
                        noteIndex = noteIndex - 42; // Convert to 0-24 range
                        console.log(`✓ MIDI note ${noteIndex + 42} maps to Minecraft Note Block index: ${noteIndex}`);
                    } else if (noteIndex < 42) {
                        // Notes below F#3 - map to lowest available note
                        noteIndex = 0;
                        console.log(`⚠ MIDI note ${noteIndex} is below F#3, mapping to index 0`);
                    } else if (noteIndex > 66) {
                        // Notes above F#5 - map to highest available note
                        noteIndex = 24;
                        console.log(`⚠ MIDI note ${noteIndex} is above F#5, mapping to index 24`);
                    } else {
                        // Fallback for any other cases
                        noteIndex = Math.max(0, Math.min(24, noteIndex % 25));
                        console.log(`⚠ MIDI note ${noteIndex} mapped to index ${noteIndex} (fallback)`);
                    }
                    
                    console.log(`Final mapped index: ${noteIndex}`);
                    
                    const noteKey = `${noteIndex},${tick}`;
                    
                    // Preserve the individual note's instrument from NBS
                    const noteInstrument = note.instrument?.id || 0;
                    
                    track.notes[noteKey] = {
                        instrument: noteInstrument,
                        pitch: noteIndex
                    };
                    
                    // Update track instrument to the most common instrument in this track
                    // This is for display purposes only - individual notes keep their own instruments
                    if (noteCount === 0) {
                        track.instrument = noteInstrument;
                    }
                    

                    noteCount++;
                }
            }
            
            this.song.tracks.push(track);
        });
        
        // If no tracks were created, add a default track
        if (this.song.tracks.length === 0) {
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
        
        for (const track of this.song.tracks) {
            for (const key in track.notes) {
                const [, tick] = key.split(',').map(Number);
                maxTickWithNotes = Math.max(maxTickWithNotes, tick);
                minTickWithNotes = Math.min(minTickWithNotes, tick);
            }
        }
        
        // Use the maximum of song size or highest tick with notes
        songLength = Math.max(songLength, maxTickWithNotes + 1);
        
        this.totalTicks = songLength;

        
        // Reset current track index
        this.currentTrackIndex = 0;
        
        // Update UI
        this.generateNoteGrid();
        this.renderTrackTabs();
        this.updateInstrumentSelector();
        this.updateVolumeSlider();
        
        // Restore note visuals after grid generation
        this.restoreNoteVisuals();
        
        // Save state
        this.saveState();
        
        // Set full view as default after importing
        this.fullViewMode = true;
        const fullViewBtn = document.getElementById('fullViewBtn');
        if (fullViewBtn) {
            fullViewBtn.textContent = '👁️ Track View';
        }
        
        // Regenerate grid to show all tracks in full view
        this.generateNoteGrid();
        this.restoreNoteVisuals();
        

        
        // Summary of imported notes
        console.log('=== NBS IMPORT SUMMARY ===');
        this.song.tracks.forEach((track, trackIndex) => {
            // Show all unique note indices in this track
            const noteIndices = new Set();
            Object.keys(track.notes).forEach(key => {
                const [noteIndex] = key.split(',').map(Number);
                noteIndices.add(noteIndex);
            });
            console.log(`Track ${trackIndex} unique note indices:`, Array.from(noteIndices).sort((a, b) => a - b));
        });
        console.log('=== NBS IMPORT SUMMARY END ===');
        
        return true;
    }

    loadSongData(songData) {
        // Validate input
        if (!songData || !songData.tracks) {
            console.error('Invalid song data: missing tracks property');
            return false;
        }

        // Copy song properties
        this.song.name = songData.name || 'Untitled Song';
        this.song.author = songData.author || 'Unknown Artist';
        this.song.tempo = songData.tempo || 120;
        this.song.timeSignature = songData.timeSignature || 4;
        
        // Update UI elements
        this.updateSongInfoFields();
        document.getElementById('tempoSlider').value = this.song.tempo;
        document.getElementById('tempoInput').value = this.song.tempo;
        document.getElementById('tempoValue').textContent = 'BPM';
        
        // Copy tracks
        this.song.tracks = JSON.parse(JSON.stringify(songData.tracks));
        
        // Calculate total ticks based on song data
        let maxTickWithNotes = 0;
        
        for (const track of this.song.tracks) {
            for (const key in track.notes) {
                const [, tick] = key.split(',').map(Number);
                maxTickWithNotes = Math.max(maxTickWithNotes, tick);
            }
        }
        
        // Use the maximum of 64 or highest tick with notes
        this.totalTicks = Math.max(64, maxTickWithNotes + 1);
        
        // Reset current track index
        this.currentTrackIndex = 0;
        
        // Update UI
        this.generateNoteGrid();
        this.renderTrackTabs();
        this.updateInstrumentSelector();
        this.updateVolumeSlider();
        
        // Update full view button text to reflect current state
        const fullViewBtn = document.getElementById('fullViewBtn');
        if (fullViewBtn) {
            fullViewBtn.textContent = this.fullViewMode ? '👁️ Track View' : '👁️ Full View';
        }
        
        // Restore note visuals after grid generation
        this.restoreNoteVisuals();
        
        // Save state
        this.saveState();
        
        return true;
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
        // Calculate correct pitch: noteIndex 12 should be F♯4 (base pitch for Minecraft noteblocks)
        // Since our noteNames array starts with F♯3 at index 0, we need to add 12 semitones to align with F♯4 at index 12
        const semitones = (noteIndex - 12) + 12; // Minecraft noteblocks: 12 clicks = F♯4 (base pitch)
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
        // Calculate correct pitch: noteIndex 12 should be F♯4 (base pitch for Minecraft noteblocks)
        // Since our noteNames array starts with F♯3 at index 0, we need to add 12 semitones to align with F♯4 at index 12
        const semitones = (noteIndex - 12) + 12; // Minecraft noteblocks: 12 clicks = F♯4 (base pitch)
        source.playbackRate.value = Math.pow(2, semitones / 12);
        
        // Create a gain node for volume control
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = volume / 100; // Convert percentage to 0-1 range
        
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        source.start(this.audioContext.currentTime + time);
    }

    toggleFullView() {
        // Prevent rapid successive calls
        if (this._togglingFullView) {
            console.log('Skipping toggleFullView - already in progress');
            return;
        }
        
        this._togglingFullView = true;
        
        try {
            this.fullViewMode = !this.fullViewMode;
            const btn = document.getElementById('fullViewBtn');
            btn.textContent = this.fullViewMode ? '👁️ Track View' : '👁️ Full View';
            this.generateNoteGrid();
        } finally {
            // Clear the flag after a short delay
            setTimeout(() => {
                this._togglingFullView = false;
            }, 200);
        }
    }

    // Get note range for a specific instrument
    getNoteRangeForInstrument(instrumentId) {
        const instrument = this.instruments[instrumentId];
        if (!instrument) return this.noteNames;
        
        const range = instrument.range;
        if (range === "—") {
            // Drums/percussion - use the full note range for visual consistency
            // Even though drums only have one sound, we show the full range for editing
            return this.noteNames;
        }
        
        // For full view mode or when we want the complete range, return all note names
        // This ensures we always show the full Minecraft Note Block range (F♯3 to F♯5)
        if (this.fullViewMode || !this.song.tracks[this.currentTrackIndex]?.notes || Object.keys(this.song.tracks[this.currentTrackIndex].notes).length === 0) {
            return this.noteNames;
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
        if (this.fullViewMode) {
            // In full view, we need to get note names that cover all instruments
            // Use a comprehensive range that covers all instruments
            return this.noteNames;
        } else {
            const track = this.song.tracks[this.currentTrackIndex];
            const instrumentNames = this.getNoteRangeForInstrument(track.instrument);
            return instrumentNames;
        }
    }

    // Restore visual state of notes after grid regeneration
    restoreNoteVisuals() {
        // Prevent multiple calls in quick succession
        if (this._restoringNotes) {
            console.log('Skipping restoreNoteVisuals - already in progress');
            return;
        }
        
        this._restoringNotes = true;
        
        try {
            let restoredCount = 0;
            
                        if (this.fullViewMode) {
                // Full view: Show notes from all tracks
                this.song.tracks.forEach((track, trackIndex) => {
                    Object.entries(track.notes).forEach(([key, note]) => {
                        const [noteIndex, tick] = key.split(',').map(Number);
                        
                        const cell = document.querySelector(`.note-cell[data-note="${noteIndex}"][data-tick="${tick}"]`);
                        
                        if (cell) {
                            cell.classList.add('active');
                            // Use the note's individual instrument for color
                            const noteInstrument = note.instrument;
                            cell.style.backgroundColor = this.instruments[noteInstrument]?.color || '';
                            // Add track index as data attribute for identification
                            cell.dataset.trackIndex = trackIndex;
                            restoredCount++;
                        }
                    });
                });
                

            } else {
                // Track view: Show only current track's notes
                const track = this.song.tracks[this.currentTrackIndex];
                
                Object.entries(track.notes).forEach(([key, note]) => {
                    const [noteIndex, tick] = key.split(',').map(Number);
                    
                    const cell = document.querySelector(`.note-cell[data-note="${noteIndex}"][data-tick="${tick}"]`);
                    
                    if (cell) {
                        cell.classList.add('active');
                        // Use the note's individual instrument for color
                        const noteInstrument = note.instrument;
                        cell.style.backgroundColor = this.instruments[noteInstrument]?.color || '';
                        cell.dataset.trackIndex = this.currentTrackIndex;
                        restoredCount++;
                    }
                });
                

            }
        } finally {
            // Clear the flag after a short delay to prevent rapid successive calls
            setTimeout(() => {
                this._restoringNotes = false;
            }, 100);
        }
    }

    // Check if any notes are outside the currently displayed range
    checkForNotesOutsideRange() {
        const noteLabels = document.querySelectorAll('.note-label');
        if (noteLabels.length === 0) return;
        
        const displayedMinNote = parseInt(noteLabels[0].dataset.note || '0');
        const displayedMaxNote = parseInt(noteLabels[noteLabels.length - 1].dataset.note || '0');
        
        let notesOutsideRange = [];
        
        this.song.tracks.forEach((track, trackIndex) => {
            Object.entries(track.notes).forEach(([key, note]) => {
                const [noteIndex, tick] = key.split(',').map(Number);
                
                if (noteIndex < displayedMinNote || noteIndex > displayedMaxNote) {
                    notesOutsideRange.push({
                        noteIndex,
                        tick,
                        trackIndex,
                        noteName: this.noteNames[noteIndex] || `Note ${noteIndex}`
                    });
                }
            });
        });
        
        if (notesOutsideRange.length > 0) {
            console.warn(`Found ${notesOutsideRange.length} notes outside the displayed range:`, notesOutsideRange);
            
            // Update status bar to show this information
            const statusBar = document.querySelector('.status-bar');
            if (statusBar) {
                const statusInfo = document.getElementById('statusInfo');
                if (statusInfo) {
                    statusInfo.textContent = `⚠️ ${notesOutsideRange.length} notes outside view (${displayedMinNote}-${displayedMaxNote})`;
                    statusInfo.style.color = '#ff6b6b';
                }
            }
        } else {
            // Clear the warning
            const statusInfo = document.getElementById('statusInfo');
            if (statusInfo) {
                statusInfo.textContent = '';
                statusInfo.style.color = '';
            }
        }
    }

    // Add a button to expand the view to show all notes
    addExpandViewButton() {
        // Remove any existing expand button
        const existingButton = document.getElementById('expandViewBtn');
        if (existingButton) {
            existingButton.remove();
        }
        
        // Check if there are notes outside the current range
        const noteLabels = document.querySelectorAll('.note-label');
        if (noteLabels.length === 0) return;
        
        const displayedMinNote = parseInt(noteLabels[0].dataset.note || '0');
        const displayedMaxNote = parseInt(noteLabels[noteLabels.length - 1].dataset.note || '0');
        
        let hasNotesOutsideRange = false;
        this.song.tracks.forEach(track => {
            Object.entries(track.notes).forEach(([key, note]) => {
                const [noteIndex, tick] = key.split(',').map(Number);
                if (noteIndex < displayedMinNote || noteIndex > displayedMaxNote) {
                    hasNotesOutsideRange = true;
                }
            });
        });
        
        if (hasNotesOutsideRange) {
            // Add expand button to the piano roll
            const pianoRoll = document.querySelector('.piano-roll');
            if (pianoRoll) {
                const expandBtn = document.createElement('button');
                expandBtn.id = 'expandViewBtn';
                expandBtn.textContent = '🔍 Show All Notes';
                expandBtn.className = 'expand-view-btn';
                expandBtn.style.cssText = `
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    z-index: 1000;
                    background: #ff6b6b;
                    color: white;
                    border: none;
                    padding: 8px 12px;
                    border-radius: 4px;
                    font-family: 'Minecraft Regular', monospace;
                    font-size: 12px;
                    cursor: pointer;
                `;
                
                expandBtn.addEventListener('click', () => {
                    this.expandToShowAllNotes();
                });
                
                pianoRoll.appendChild(expandBtn);
            }
        }
    }

    // Expand the view to show all notes in the song
    expandToShowAllNotes() {
        // Find the actual min and max notes used in the song
        let actualMinNote = 255;
        let actualMaxNote = 0;
        let hasNotes = false;
        
        this.song.tracks.forEach(track => {
            Object.entries(track.notes).forEach(([key, note]) => {
                const [noteIndex, tick] = key.split(',').map(Number);
                if (noteIndex >= 0 && noteIndex <= 24) {
                    actualMinNote = Math.min(actualMinNote, noteIndex);
                    actualMaxNote = Math.max(actualMaxNote, noteIndex);
                    hasNotes = true;
                }
            });
        });
        
        if (hasNotes) {
            // Add padding to the range
            actualMinNote = Math.max(0, actualMinNote - 2);
            actualMaxNote = Math.min(24, actualMaxNote + 2);
            
            // Regenerate grid with the full range
            this.generateNoteGridWithRange(actualMinNote, actualMaxNote);
        }
    }

    // Generate note grid with a specific note range
    generateNoteGridWithRange(minNote, maxNote) {
        const gridContainer = document.getElementById('gridContainer');
        const noteLabels = document.querySelector('.piano-keys');
        const tickLabels = document.querySelector('.tick-labels');
        
        noteLabels.innerHTML = '';
        tickLabels.innerHTML = '';
        gridContainer.innerHTML = '';
        
        // Use the full song length for the visual grid
        const visualTicks = this.totalTicks;
        
        // Update CSS custom property for song length
        document.documentElement.style.setProperty('--song-length', visualTicks);
        
        const noteRange = maxNote - minNote + 1;
        
        // Update CSS custom property for note range
        document.documentElement.style.setProperty('--note-range', noteRange);
        
        // Generate tick labels
        for (let tick = 0; tick < visualTicks; tick++) {
            const tickLabel = document.createElement('div');
            tickLabel.className = 'tick-label';
            tickLabel.textContent = tick;
            tickLabels.appendChild(tickLabel);
        }
        
        // Generate note labels
        const noteNames = this.getCurrentNoteNames();
        for (let i = minNote; i <= maxNote; i++) {
            const label = document.createElement('div');
            label.className = 'note-label';
            label.textContent = noteNames[i] || '';
            label.dataset.note = i;
            noteLabels.appendChild(label);
        }
        
        // Generate grid cells
        for (let i = minNote; i <= maxNote; i++) {
            for (let tick = 0; tick < visualTicks; tick++) {
                const cell = document.createElement('div');
                cell.className = 'note-cell';
                cell.dataset.note = i;
                cell.dataset.tick = tick;
                gridContainer.appendChild(cell);
            }
        }
        
        // Update CSS grid template rows
        // Remove inline style override - let CSS variable handle it
        // const gridContainerStyle = gridContainer.style;
        // gridContainerStyle.gridTemplateRows = `repeat(${noteRange}, 25px)`;
        console.log(`CSS variable --note-range set to: ${noteRange}`);
        
        // Debug: Check computed CSS grid styles
        const computedStyle = window.getComputedStyle(gridContainer);
        console.log(`Computed grid-template-rows: ${computedStyle.gridTemplateRows}`);
        console.log(`Computed grid-template-columns: ${computedStyle.gridTemplateColumns}`);
        
        // Restore visual state of notes
        this.restoreNoteVisuals();
        
        // Remove the expand button since we've expanded
        const expandBtn = document.getElementById('expandViewBtn');
        if (expandBtn) {
            expandBtn.remove();
        }
        
        // Clear any warnings
        const statusInfo = document.getElementById('statusInfo');
        if (statusInfo) {
            statusInfo.textContent = '';
            statusInfo.style.color = '';
        }
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

    // Add a method to monitor audio context state
    monitorAudioContextState() {
        if (this.audioContext) {
            const state = this.audioContext.state;
            console.log(`DEBUG: Audio Context State: ${state}`);
            if (state === 'suspended') {
                console.warn('Audio context is suspended. Attempting to resume...');
                this.audioContext.resume().then(() => {
                    console.log('Audio context resumed successfully.');
                }).catch(error => {
                    console.error('Failed to resume audio context:', error);
                });
            } else if (state === 'closed') {
                console.error('Audio context is closed. Cannot play audio.');
                // Optionally, show an error message to the user or handle the situation
            }
        } else {
            console.warn('Audio context is not initialized. Cannot monitor state.');
        }
    }

    // Add performance monitoring for timing drift
    monitorTimingPerformance() {
        if (!this.isPlaying) return;
        
        const currentTime = performance.now();
        const audioTime = this.audioContext.currentTime;
        const expectedTime = this.playStartTime + (this.currentTick - this.playStartTick) * (60 / this.song.tempo) / 4;
        
        const drift = Math.abs(audioTime - expectedTime);
        if (drift > 0.1) { // More than 100ms drift
            console.warn(`DEBUG: Timing drift detected - Drift: ${(drift * 1000).toFixed(2)}ms, Audio time: ${audioTime.toFixed(3)}s, Expected: ${expectedTime.toFixed(3)}s`);
        }
        
        // Schedule next performance check
        setTimeout(() => this.monitorTimingPerformance(), 1000); // Check every second
    }

    // Proper audio scheduler using Web Audio API with lookahead
    scheduler() {
        if (!this.isPlaying) return;
        
        const currentTime = this.audioContext.currentTime;
        const tickDuration = (60 / this.song.tempo) / 4; // seconds per tick
        
        // Schedule all ticks that should play within the lookahead window
        while (this.nextTickTime < currentTime + this.scheduleAheadTime) {
            // Schedule the tick
            this.scheduleTick(this.currentTick, this.nextTickTime);
            
            // Advance to next tick
            this.currentTick++;
            this.nextTickTime += tickDuration;
            
            // Check if we've reached the end
            if (this.currentTick >= this.totalTicks) {
                console.log(`DEBUG: Playback finished at tick ${this.currentTick}`);
                this.stop();
                return;
            }
        }
        
        // Schedule next scheduler call
        this.schedulerTimeout = setTimeout(() => this.scheduler(), this.schedulerInterval);
    }
    
    // Schedule a specific tick to play at a specific time
    scheduleTick(tick, time) {
        // DEBUG: Log scheduling
        if (tick % 20 === 0) {
            console.log(`DEBUG: Scheduling tick ${tick} at time ${time.toFixed(3)}s`);
        }
        
        // Reset all playing states
        document.querySelectorAll('.note-cell.playing').forEach(cell => {
            cell.classList.remove('playing');
        });
        
        // Play notes for all tracks at this tick
        let notesPlayed = 0;
        for (const track of this.song.tracks) {
            for (const key in track.notes) {
                const [noteIndex, noteTick] = key.split(',').map(Number);
                if (noteTick === tick) {
                    // Use the note's individual instrument, not the track's instrument
                    const noteInstrument = track.notes[key].instrument;
                    // Schedule the note to play at the precise time
                    this.scheduleNote(noteIndex, noteInstrument, track.volume, time);
                    notesPlayed++;
                    
                    // Schedule visual highlighting at the same time
                    this.scheduleNoteHighlight(noteIndex, tick, time);
                }
            }
        }
        
        // Schedule playhead update at the same time
        this.schedulePlayheadUpdate(tick, time);
        
        if (notesPlayed > 0) {
            console.log(`DEBUG: Scheduled ${notesPlayed} notes for tick ${tick} at time ${time.toFixed(3)}s`);
        }
    }
    
    // Schedule a note to play at a specific time
    scheduleNote(noteIndex, instrumentId, volume, time) {
        // Create audio buffer source
        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();
        
        // Set the buffer
        source.buffer = this.buffers.get(instrumentId); // Use this.buffers
        
        // Calculate correct pitch: noteIndex 12 should be F♯4 (base pitch for Minecraft noteblocks)
        // Since our noteNames array starts with F♯3 at index 0, we need to add 12 semitones to align with F♯4 at index 12
        const semitones = (noteIndex - 12) + 12; // Minecraft noteblocks: 12 clicks = F♯4 (base pitch)
        source.playbackRate.value = Math.pow(2, semitones / 12);
        
        // Set volume
        gainNode.gain.setValueAtTime(0, time);
        gainNode.gain.linearRampToValueAtTime(volume / 100, time + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
        
        // Connect nodes
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Schedule playback
        source.start(time);
        source.stop(time + 0.5);
    }
    
    // Schedule playhead update at a specific time
    schedulePlayheadUpdate(tick, time) {
        // Update playhead immediately for visual consistency
        // The audio timing is handled separately, so we can update visuals immediately
        if (this.isPlaying) {
            this.currentTick = tick;
            this.updatePlayhead();
            
            // DEBUG: Log playhead updates every 20 ticks
            if (tick % 20 === 0) {
                console.log(`DEBUG: Playhead update - Tick: ${tick}, Time: ${time.toFixed(3)}s, Audio time: ${this.audioContext.currentTime.toFixed(3)}s`);
            }
        }
    }
    
    // Schedule note highlighting at a specific time
    scheduleNoteHighlight(noteIndex, tick, time) {
        setTimeout(() => {
            const cell = document.querySelector(`[data-note="${noteIndex}"][data-tick="${tick}"]`);
            if (cell && cell.classList.contains('active')) {
                cell.classList.add('playing');
                setTimeout(() => {
                    cell.classList.remove('playing');
                }, 100);
            }
        }, time * 1000);
    }

    // New methods for enhanced features
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts when typing in input fields
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    if (this.isPlaying) {
                        this.pause();
                    } else {
                        this.play();
                    }
                    break;
                case 'r':
                case 'R':
                    e.preventDefault();
                    this.stop();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.currentTick = Math.max(0, this.currentTick - 1);
                    this.updatePlayhead();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.currentTick = Math.min(this.totalTicks - 1, this.currentTick + 1);
                    this.updatePlayhead();
                    break;
                case 'Home':
                    e.preventDefault();
                    this.currentTick = 0;
                    this.updatePlayhead();
                    break;
                case 'End':
                    e.preventDefault();
                    this.currentTick = this.totalTicks - 1;
                    this.updatePlayhead();
                    break;
                case 'f':
                case 'F':
                    e.preventDefault();
                    this.toggleFullView();
                    break;
                case 'Delete':
                    e.preventDefault();
                    this.clearSelection();
                    break;
                case 'a':
                case 'A':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.selectAll();
                    }
                    break;
                case 'z':
                case 'Z':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.undo();
                    }
                    break;
                case 'y':
                case 'Y':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.redo();
                    }
                    break;
                case 'c':
                case 'C':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.copySelection();
                    }
                    break;
                case 'v':
                case 'V':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.pasteSelection();
                    }
                    break;
            }
        });
    }

    setupModalHandlers() {
        const helpModal = document.getElementById('helpModal');
        const helpBtn = document.getElementById('helpBtn');
        const closeHelp = document.getElementById('closeHelp');

        helpBtn.addEventListener('click', () => {
            helpModal.style.display = 'block';
        });

        closeHelp.addEventListener('click', () => {
            helpModal.style.display = 'none';
        });

        // Close modal when clicking outside
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) {
                helpModal.style.display = 'none';
            }
        });

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && helpModal.style.display === 'block') {
                helpModal.style.display = 'none';
            }
        });
    }

    updateStatusBar() {
        const currentPosition = document.getElementById('currentPosition');
        const totalLength = document.getElementById('totalLength');
        const currentTrack = document.getElementById('currentTrack');
        const noteCount = document.getElementById('noteCount');

        if (currentPosition) currentPosition.textContent = this.currentTick;
        if (totalLength) totalLength.textContent = this.totalTicks;
        if (currentTrack) currentTrack.textContent = this.currentTrackIndex + 1;

        // Count notes in current track
        const track = this.song.tracks[this.currentTrackIndex];
        const noteCountValue = Object.keys(track.notes).length;
        if (noteCount) noteCount.textContent = noteCountValue;
    }

    setupGridSizeControl() {
        const gridSizeSlider = document.getElementById('gridSizeSlider');
        const gridSizeValue = document.getElementById('gridSizeValue');

        if (gridSizeSlider && gridSizeValue) {
            gridSizeSlider.addEventListener('input', (e) => {
                const newSize = parseInt(e.target.value);
                gridSizeValue.textContent = newSize;
                this.resizeGrid(newSize);
            });
        }
    }

    resizeGrid(newSize) {
        this.totalTicks = newSize;
        this.currentTick = Math.min(this.currentTick, newSize - 1);
        
        // Update CSS custom properties
        document.documentElement.style.setProperty('--song-length', newSize);
        
        // Regenerate the grid
        this.generateNoteGrid();
        this.updatePlayhead();
        this.updateStatusBar();
    }

    selectAll() {
        this.selection = {
            start: { tick: 0, note: 0 },
            end: { tick: this.totalTicks - 1, note: this.noteNames.length - 1 },
            active: true
        };
        this.updateSelectionVisual();
    }

    clearSelection() {
        if (this.selection.active) {
            const track = this.song.tracks[this.currentTrackIndex];
            const startTick = Math.min(this.selection.start.tick, this.selection.end.tick);
            const endTick = Math.max(this.selection.start.tick, this.selection.end.tick);
            const startNote = Math.min(this.selection.start.note, this.selection.end.note);
            const endNote = Math.max(this.selection.start.note, this.selection.end.note);

            for (let tick = startTick; tick <= endTick; tick++) {
                for (let note = startNote; note <= endNote; note++) {
                    const key = `${note},${tick}`;
                    if (track.notes[key]) {
                        delete track.notes[key];
                    }
                }
            }
            this.restoreNoteVisuals();
            this.saveState();
        }
    }

    copySelection() {
        if (!this.selection.active) {
            console.log('No active selection to copy');
            return;
        }

        const track = this.song.tracks[this.currentTrackIndex];
        const startTick = Math.min(this.selection.start.tick, this.selection.end.tick);
        const endTick = Math.max(this.selection.start.tick, this.selection.end.tick);
        const startNote = Math.min(this.selection.start.note, this.selection.end.note);
        const endNote = Math.max(this.selection.start.note, this.selection.end.note);

        this.clipboard = {
            width: endTick - startTick + 1,
            height: endNote - startNote + 1,
            notes: {},
            instrument: track.instrument
        };

        let noteCount = 0;
        for (let tick = startTick; tick <= endTick; tick++) {
            for (let note = startNote; note <= endNote; note++) {
                const key = `${note},${tick}`;
                if (track.notes[key]) {
                    const relativeTick = tick - startTick;
                    const relativeNote = note - startNote;
                    this.clipboard.notes[`${relativeNote},${relativeTick}`] = track.notes[key];
                    noteCount++;
                }
            }
        }

        // Enable paste button
        const pasteBtn = document.getElementById('pasteBtn');
        if (pasteBtn) pasteBtn.disabled = false;
        
        console.log(`Copied ${noteCount} notes to clipboard`);
    }

    pasteSelection() {
        if (!this.clipboard) {
            console.log('No clipboard data to paste');
            return;
        }

        const track = this.song.tracks[this.currentTrackIndex];
        const pasteStartTick = this.currentTick;
        const pasteStartNote = 0; // Start from top

        // Clear existing notes in paste area
        for (let tick = pasteStartTick; tick < pasteStartTick + this.clipboard.width; tick++) {
            for (let note = pasteStartNote; note < pasteStartNote + this.clipboard.height; note++) {
                const key = `${note},${tick}`;
                if (track.notes[key]) {
                    delete track.notes[key];
                }
            }
        }

        // Paste clipboard notes
        let pastedCount = 0;
        for (const [key, noteData] of Object.entries(this.clipboard.notes)) {
            const [relativeNote, relativeTick] = key.split(',').map(Number);
            const absoluteTick = pasteStartTick + relativeTick;
            const absoluteNote = pasteStartNote + relativeNote;
            
            if (absoluteTick < this.totalTicks && absoluteNote < this.noteNames.length) {
                track.notes[`${absoluteNote},${absoluteTick}`] = {
                    ...noteData,
                    instrument: track.instrument
                };
                pastedCount++;
            }
        }

        this.restoreNoteVisuals();
        this.saveState();
        
        console.log(`Pasted ${pastedCount} notes at tick ${pasteStartTick}`);
    }

    updateSelectionVisual() {
        const selectionBox = document.getElementById('selectionBox');
        const selectionStatus = document.getElementById('selectionStatus');
        const selectionInfo = document.getElementById('selectionInfo');
        
        if (!this.selection.active) {
            if (selectionBox) selectionBox.style.display = 'none';
            if (selectionStatus) selectionStatus.style.display = 'none';
            return;
        }

        const startTick = Math.min(this.selection.start.tick, this.selection.end.tick);
        const endTick = Math.max(this.selection.start.tick, this.selection.end.tick);
        const startNote = Math.min(this.selection.start.note, this.selection.end.note);
        const endNote = Math.max(this.selection.start.note, this.selection.end.note);

        const left = startTick * 25 + 64; // 25px per tick + piano keys width
        const top = startNote * 25 + 32; // 25px per note + tick labels height
        const width = (endTick - startTick + 1) * 25;
        const height = (endNote - startNote + 1) * 25;

        if (selectionBox) {
            selectionBox.style.left = `${left}px`;
            selectionBox.style.top = `${top}px`;
            selectionBox.style.width = `${width}px`;
            selectionBox.style.height = `${height}px`;
            selectionBox.style.display = 'block';
        }

        // Update selection status
        if (selectionStatus && selectionInfo) {
            const width = endTick - startTick + 1;
            const height = endNote - startNote + 1;
            selectionInfo.textContent = `${width}×${height} notes`;
            selectionStatus.style.display = 'block';
        }
    }

    startSelection(e) {
        const rect = e.target.getBoundingClientRect();
        const gridRect = document.getElementById('gridContainer').getBoundingClientRect();
        
        const note = parseInt(e.target.dataset.note);
        const tick = parseInt(e.target.dataset.tick);
        
        this.selection = {
            start: { note, tick },
            end: { note, tick },
            active: true
        };
        
        this.isSelecting = true;
        
        const selectionHandler = (e) => {
            if (!this.isSelecting) return;
            
            const targetCell = document.elementFromPoint(e.clientX, e.clientY);
            if (targetCell && targetCell.classList.contains('note-cell')) {
                const newNote = parseInt(targetCell.dataset.note);
                const newTick = parseInt(targetCell.dataset.tick);
                
                this.selection.end = { note: newNote, tick: newTick };
                this.updateSelectionVisual();
            }
        };
        
        const endSelectionHandler = () => {
            this.isSelecting = false;
            document.removeEventListener('mousemove', selectionHandler);
            document.removeEventListener('mouseup', endSelectionHandler);
        };
        
        document.addEventListener('mousemove', selectionHandler);
        document.addEventListener('mouseup', endSelectionHandler);
        
        this.updateSelectionVisual();
    }

    getCellFromCoordinates(note, tick) {
        return document.querySelector(`[data-note="${note}"][data-tick="${tick}"]`);
    }

    // URL sharing and library methods
    async getDefaultSongs() {
        try {
            // Try to fetch the songs index from assets/songs/index.json
            const response = await fetch('assets/songs/index.json');
            if (!response.ok) {
                // If we can't fetch the index, fall back to hardcoded songs
                console.warn('Could not fetch songs index, using fallback songs');
                return this.getFallbackSongs();
            }
            
            const index = await response.json();
            const songFiles = index.songs || [];
            
            if (songFiles.length === 0) {
                console.warn('No .nbs files found in assets/songs/, using fallback songs');
                return this.getFallbackSongs();
            }
            
            // Load each NBS file
            const songs = [];
            for (const fileName of songFiles) {
                try {
                    const songData = await this.loadNBSFile(`assets/songs/${fileName}`);
                    if (songData) {
                        songs.push({
                            name: fileName.replace('.nbs', ''),
                            author: songData.author || 'Unknown',
                            description: `Loaded from ${fileName}`,
                            data: songData
                        });
                    }
                } catch (error) {
                    console.error(`Error loading ${fileName}:`, error);
                }
            }
            
            return songs;
        } catch (error) {
            console.error('Error loading songs from assets/songs/:', error);
            return this.getFallbackSongs();
        }
    }

    getFallbackSongs() {
        return [
            {
                name: "Default Song 1",
                author: "Minecraft Music Studio",
                description: "A simple melody to get you started",
                data: this.createDefaultSong1()
            },
            {
                name: "Default Song 2", 
                author: "Minecraft Music Studio",
                description: "A more complex arrangement with multiple tracks",
                data: this.createDefaultSong2()
            }
        ];
    }



    async loadNBSFile(filePath) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            
            // Parse the NBS file using the existing NBS.js parser
            const song = Song.fromArrayBuffer(arrayBuffer);
            
            // Convert to our internal format
            return this.convertNBSToSongData(song);
        } catch (error) {
            console.error(`Error loading NBS file ${filePath}:`, error);
            return null;
        }
    }

    convertNBSToSongData(nbsSong) {
        // Convert NBS format to our internal song data format
        const songData = {
            name: nbsSong.name || 'Unknown Song',
            author: nbsSong.author || 'Unknown Author',
            originalAuthor: nbsSong.originalAuthor || '',
            description: nbsSong.description || '',
            tempo: Math.min((nbsSong.tempo * 60) / 4, 600), // Convert NBS tempo to BPM, max 600
            timeSignature: 4,
            length: nbsSong.length || 64,
            tracks: []
        };

        // Convert layers to tracks
        if (nbsSong.layers && nbsSong.layers.length > 0) {
            for (let i = 0; i < nbsSong.layers.length; i++) {
                const layer = nbsSong.layers[i];
                if (layer && layer.notes) {
                    const track = {
                        instrument: layer.instrument || 0,
                        notes: {},
                        volume: layer.volume || 100
                    };

                    // Convert notes
                    for (const [tick, note] of Object.entries(layer.notes)) {
                        if (note && typeof note.key === 'number') {
                            // Convert MIDI note numbers to Minecraft Note Block range (0-24)
                            // Minecraft Note Blocks range from F#3 (MIDI 42) to F#5 (MIDI 66)
                            let noteIndex = note.key;
                            
                            if (noteIndex >= 42 && noteIndex <= 66) {
                                // Direct mapping from MIDI to Minecraft Note Block range
                                noteIndex = noteIndex - 42; // Convert to 0-24 range
                            } else if (noteIndex < 42) {
                                // Notes below F#3 - map to lowest available note
                                noteIndex = 0;
                            } else if (noteIndex > 66) {
                                // Notes above F#5 - map to highest available note
                                noteIndex = 24;
                            } else {
                                // Fallback for any other cases
                                noteIndex = Math.max(0, Math.min(24, noteIndex % 25));
                            }
                            
                            track.notes[`${noteIndex},${tick}`] = {
                                instrument: note.instrument?.id || layer.instrument || 0,
                                pitch: noteIndex
                            };
                        }
                    }

                    if (Object.keys(track.notes).length > 0) {
                        songData.tracks.push(track);
                    }
                }
            }
        }

        // If no tracks were created, create a default track
        if (songData.tracks.length === 0) {
            songData.tracks.push({
                instrument: 0,
                notes: {},
                volume: 100
            });
        }

        return songData;
    }

    createDefaultSong1() {
        // Simple C major scale melody using Minecraft Note Block range (0-24)
        // Map: F♯3=0, G3=1, G♯3=2, A3=3, A♯3=4, B3=5, C4=6, C♯4=7, D4=8, D♯4=9, E4=10, F4=11, F♯4=12
        //      G4=13, G♯4=14, A4=15, A♯4=16, B4=17, C5=18, C♯5=19, D5=20, D♯5=21, E5=22, F5=23, F♯5=24
        const song = {
            name: "Default Song 1",
            author: "Minecraft Music Studio",
            originalAuthor: "",
            description: "A simple C major scale melody",
            tempo: 120,
            timeSignature: 4,
            length: 32,
            tracks: [
                {
                    instrument: 0, // Harp
                    notes: {
                        "6,0": { instrument: 0, pitch: 6 },   // C4
                        "6,4": { instrument: 0, pitch: 6 },   // C4
                        "7,8": { instrument: 0, pitch: 7 },   // C♯4
                        "8,12": { instrument: 0, pitch: 8 },  // D4
                        "9,16": { instrument: 0, pitch: 9 },  // D♯4
                        "10,20": { instrument: 0, pitch: 10 }, // E4
                        "11,24": { instrument: 0, pitch: 11 }, // F4
                        "12,28": { instrument: 0, pitch: 12 }  // F♯4
                    },
                    volume: 100
                }
            ]
        };
        return song;
    }

    createDefaultSong2() {
        // More complex song with multiple tracks
        // Map: F♯3=0, G3=1, G♯3=2, A3=3, A♯3=4, B3=5, C4=6, C♯4=7, D4=8, D♯4=9, E4=10, F4=11, F♯4=12
        //      G4=13, G♯4=14, A4=15, A♯4=16, B4=17, C5=18, C♯5=19, D5=20, D♯5=21, E5=22, F5=23, F♯5=24
        const song = {
            name: "Default Song 2",
            author: "Minecraft Music Studio", 
            originalAuthor: "",
            description: "A more complex arrangement with melody and bass",
            tempo: 140,
            timeSignature: 4,
            length: 48,
            tracks: [
                {
                    instrument: 0, // Harp - Melody
                    notes: {
                        "6,0": { instrument: 0, pitch: 6 },   // C4
                        "6,8": { instrument: 0, pitch: 6 },   // C4
                        "8,16": { instrument: 0, pitch: 8 },  // D4
                        "10,24": { instrument: 0, pitch: 10 }, // E4
                        "11,32": { instrument: 0, pitch: 11 }, // F4
                        "13,40": { instrument: 0, pitch: 13 }  // G4
                    },
                    volume: 100
                },
                {
                    instrument: 1, // Bass
                    notes: {
                        "3,0": { instrument: 1, pitch: 3 },   // A3
                        "3,16": { instrument: 1, pitch: 3 },  // A3
                        "5,32": { instrument: 1, pitch: 5 }   // B3
                    },
                    volume: 80
                },
                {
                    instrument: 2, // Bass Drum
                    notes: {
                        "0,0": { instrument: 2, pitch: 0 },   // Bass Drum
                        "0,16": { instrument: 2, pitch: 0 },  // Bass Drum
                        "0,32": { instrument: 2, pitch: 0 }   // Bass Drum
                    },
                    volume: 90
                }
            ]
        };
        return song;
    }

    encodeSongToURL(song) {
        try {
            // Convert song to JSON and compress
            const jsonString = JSON.stringify(song);
            
            // Simple compression: replace common patterns
            let compressed = jsonString
                .replace(/"instrument":/g, '"i":')
                .replace(/"pitch":/g, '"p":')
                .replace(/"volume":/g, '"v":')
                .replace(/"name":/g, '"n":')
                .replace(/"author":/g, '"a":')
                .replace(/"description":/g, '"d":')
                .replace(/"tempo":/g, '"t":')
                .replace(/"tracks":/g, '"tr":')
                .replace(/"notes":/g, '"nt":');
            
            // Convert to base64
            const base64 = btoa(compressed);
            
            // Create URL with song data
            const url = new URL(window.location);
            url.searchParams.set('song', base64);
            return url.toString();
        } catch (error) {
            console.error('Error encoding song to URL:', error);
            return window.location.toString();
        }
    }

    decodeSongFromURL() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const songData = urlParams.get('song');
            
            if (!songData) return null;
            
            // Decode from base64
            const compressed = atob(songData);
            
            // Decompress: restore original property names
            let jsonString = compressed
                .replace(/"i":/g, '"instrument":')
                .replace(/"p":/g, '"pitch":')
                .replace(/"v":/g, '"volume":')
                .replace(/"n":/g, '"name":')
                .replace(/"a":/g, '"author":')
                .replace(/"d":/g, '"description":')
                .replace(/"t":/g, '"tempo":')
                .replace(/"tr":/g, '"tracks":')
                .replace(/"nt":/g, '"notes":');
            
            const song = JSON.parse(jsonString);
            return song;
        } catch (error) {
            console.error('Error decoding song from URL:', error);
            return null;
        }
    }

    loadSongFromURL() {
        const song = this.decodeSongFromURL();
        if (song) {
            this.loadSongData(song);
            return true;
        }
        return false;
    }

    setupLibraryHandlers() {
        const libraryModal = document.getElementById('libraryModal');
        const libraryBtn = document.getElementById('libraryBtn');
        const newSongBtn = document.getElementById('newSongBtn');
        const closeLibrary = document.getElementById('closeLibrary');

        libraryBtn.addEventListener('click', async () => {
            await this.populateLibrary();
            libraryModal.style.display = 'block';
        });

        newSongBtn.addEventListener('click', () => {
            this.createNewSong();
        });

        closeLibrary.addEventListener('click', () => {
            libraryModal.style.display = 'none';
        });

        // Close modal when clicking outside
        libraryModal.addEventListener('click', (e) => {
            if (e.target === libraryModal) {
                libraryModal.style.display = 'none';
            }
        });
    }

    createNewSong() {
        // Create a new empty song
        const newSong = {
            name: "New Song",
            author: "Player",
            originalAuthor: "",
            description: "",
            tempo: 120,
            timeSignature: 4,
            length: 64,
            tracks: [{
                instrument: 0,
                notes: {},
                volume: 100
            }]
        };
        
        // Load the new song
        this.loadSongData(newSong);
        
        // Update song info fields
        this.updateSongInfoFields();
        
        // Save state
        this.saveState();
        
        // Show a brief notification
        this.updateStatusBar('New song created! ✨');
    }

    setupShareHandlers() {
        const shareModal = document.getElementById('shareModal');
        const shareBtn = document.getElementById('shareBtn');
        const closeShare = document.getElementById('closeShare');
        const copyUrlBtn = document.getElementById('copyUrlBtn');
        const shareUrlInput = document.getElementById('shareUrl');

        shareBtn.addEventListener('click', () => {
            const shareUrl = this.encodeSongToURL(this.song);
            shareUrlInput.value = shareUrl;
            shareModal.style.display = 'block';
        });

        closeShare.addEventListener('click', () => {
            shareModal.style.display = 'none';
        });

        copyUrlBtn.addEventListener('click', () => {
            shareUrlInput.select();
            document.execCommand('copy');
            copyUrlBtn.textContent = '✅ Copied!';
            setTimeout(() => {
                copyUrlBtn.textContent = '📋 Copy';
            }, 2000);
        });

        // Close modal when clicking outside
        shareModal.addEventListener('click', (e) => {
            if (e.target === shareModal) {
                shareModal.style.display = 'none';
            }
        });

        // Social media share buttons
        document.getElementById('shareTwitterBtn').addEventListener('click', () => {
            const url = this.encodeSongToURL(this.song);
            const text = `Check out my Minecraft song: "${this.song.name}" by ${this.song.author}`;
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`);
        });

        document.getElementById('shareDiscordBtn').addEventListener('click', () => {
            const url = this.encodeSongToURL(this.song);
            const text = `Check out my Minecraft song: "${this.song.name}" by ${this.song.author}`;
            window.open(`https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=0&scope=bot`);
        });

        document.getElementById('shareRedditBtn').addEventListener('click', () => {
            const url = this.encodeSongToURL(this.song);
            const text = `Check out my Minecraft song: "${this.song.name}" by ${this.song.author}`;
            window.open(`https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`);
        });
    }

    async populateLibrary() {
        const defaultSongsContainer = document.getElementById('defaultSongs');
        const sharedSongsContainer = document.getElementById('sharedSongs');

        // Clear existing content
        defaultSongsContainer.innerHTML = '';
        sharedSongsContainer.innerHTML = '';

        // Reload songs from assets/songs/ directory
        try {
            this.defaultSongs = await this.getDefaultSongs();
        } catch (error) {
            console.error('Error reloading songs:', error);
            this.defaultSongs = this.getFallbackSongs();
        }

        // Populate default songs
        this.defaultSongs.forEach((song, index) => {
            const songCard = this.createSongCard(song.data, 'default', index);
            defaultSongsContainer.appendChild(songCard);
        });

        // Populate shared songs from URL
        const sharedSong = this.decodeSongFromURL();
        if (sharedSong) {
            const songCard = this.createSongCard(sharedSong, 'shared', 0);
            sharedSongsContainer.appendChild(songCard);
        }
    }

    createSongCard(song, type, index) {
        const card = document.createElement('div');
        card.className = 'song-card';
        card.dataset.type = type;
        card.dataset.index = index;

        const title = document.createElement('div');
        title.className = 'song-title';
        title.textContent = song.name;

        const author = document.createElement('div');
        author.className = 'song-author';
        author.textContent = `by ${song.author}`;

        const info = document.createElement('div');
        info.className = 'song-info';
        
        const tempo = document.createElement('span');
        tempo.textContent = `${song.tempo} BPM`;
        
        const tracks = document.createElement('span');
        tracks.textContent = `${song.tracks.length} track${song.tracks.length !== 1 ? 's' : ''}`;

        info.appendChild(tempo);
        info.appendChild(tracks);

        card.appendChild(title);
        card.appendChild(author);
        card.appendChild(info);

        card.addEventListener('click', () => {
            this.loadSongData(song);
            document.getElementById('libraryModal').style.display = 'none';
        });

        return card;
    }


}

// Initialize NBSEditor as before
document.addEventListener('DOMContentLoaded', () => {
    const editor = new NBSEditor();
});
