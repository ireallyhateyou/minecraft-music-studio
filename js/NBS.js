class Song {
    constructor() {
        this.name = "";
        this.author = "";
        this.originalAuthor = "";
        this.description = "";
        this.tempo = 5;
        this.timeSignature = 4;
        this.size = 0;
        this.layers = [];
        this.instruments = this.getBuiltinInstruments();
        this.minutesSpent = 0;
        this.leftClicks = 0;
        this.rightClicks = 0;
        this.blocksAdded = 0;
        this.blocksRemoved = 0;
        this.midiName = "";
    }

    getBuiltinInstruments() {
        return [
            { id: 0, name: "Harp" },
            { id: 1, name: "Double Bass" },
            { id: 2, name: "Bass Drum" },
            { id: 3, name: "Snare Drum" },
            { id: 4, name: "Click" },
            { id: 5, name: "Guitar" },
            { id: 6, name: "Flute" },
            { id: 7, name: "Bell" },
            { id: 8, name: "Chime" },
            { id: 9, name: "Xylophone" },
            { id: 10, name: "Iron Xylophone" },
            { id: 11, name: "Cow Bell" },
            { id: 12, name: "Didgeridoo" },
            { id: 13, name: "Bit" },
            { id: 14, name: "Banjo" },
            { id: 15, name: "Pling" }
        ];
    }

    addLayer() {
        const layer = new Layer(this, this.layers.length);
        this.layers.push(layer);
        return layer;
    }

    static toArrayBuffer(song) {
        const writeOperations = {
            writeString(str) {
                bufferSize += 4 + str.length;
            },
            writeByte() {
                bufferSize += 1;
            },
            writeShort() {
                bufferSize += 2;
            },
            writeInt() {
                bufferSize += 4;
            }
        };

        let bufferSize = 0;
        Song.writeSongData(song, writeOperations);

        const arrayBuffer = new ArrayBuffer(bufferSize);
        const dataView = new DataView(arrayBuffer);
        let currentByte = 0;

        Song.writeSongData(song, {
            writeString: (str) => {
                dataView.setInt32(currentByte, str.length, true);
                currentByte += 4;
                for (let i = 0; i < str.length; i++) {
                    dataView.setUint8(currentByte, str.charCodeAt(i));
                    currentByte++;
                }
            },
            writeByte: (byte) => {
                dataView.setInt8(currentByte, byte, true);
                currentByte++;
            },
            writeShort: (short) => {
                dataView.setInt16(currentByte, short, true);
                currentByte += 2;
            },
            writeInt: (int) => {
                dataView.setInt32(currentByte, int, true);
                currentByte += 4;
            }
        });

        return arrayBuffer;
    }

    static writeSongData(song, ops) {
        const { writeString, writeByte, writeShort, writeInt } = ops;

        // Header
        writeShort(0); // New format marker
        writeByte(4); // NBS version (4)
        writeByte(16); // Vanilla instrument count
        writeShort(song.size); // Song length
        writeShort(song.layers.length); // Layer count
        writeString(song.name);
        writeString(song.author);
        writeString(song.originalAuthor);
        writeString(song.description);
        writeShort(song.tempo * 100); // Tempo (ticks per second * 100)
        writeByte(0); // Auto-saving enabled
        writeByte(0); // Auto-saving duration
        writeByte(song.timeSignature);
        writeInt(song.minutesSpent);
        writeInt(song.leftClicks);
        writeInt(song.rightClicks);
        writeInt(song.blocksAdded);
        writeInt(song.blocksRemoved);
        writeString(song.midiName);
        writeByte(0); // Loop on/off
        writeByte(0); // Max loop count
        writeShort(0); // Loop start tick

        // Notes
        let currentTick = -1;
        for (let tick = 0; tick < song.size; tick++) {
            let hasNotes = false;
            for (const layer of song.layers) {
                if (layer.notes[tick]) {
                    hasNotes = true;
                    break;
                }
            }
            if (!hasNotes) continue;

            const tickJump = tick - currentTick;
            currentTick = tick;
            writeShort(tickJump);

            let currentLayer = -1;
            for (let layerIdx = 0; layerIdx < song.layers.length; layerIdx++) {
                const layer = song.layers[layerIdx];
                const note = layer.notes[tick];
                if (note) {
                    const layerJump = layerIdx - currentLayer;
                    currentLayer = layerIdx;
                    writeShort(layerJump);
                    writeByte(note.instrument.id);
                    writeByte(note.key);
                    writeByte(note.velocity || 100); // Volume (NBS v4+)
                    writeByte(note.panning || 100); // Panning (NBS v4+)
                    writeShort(note.pitch || 0); // Pitch (NBS v4+)
                }
            }
            writeShort(0); // End of tick
        }
        writeShort(0); // End of notes

        // Layers
        for (const layer of song.layers) {
            writeString(layer.name);
            writeByte(0); // Layer lock (NBS v4+)
            writeByte(100); // Layer volume (0-100)
            writeByte(100); // Layer stereo (NBS v2+)
        }

        // Custom instruments (none)
        writeByte(0);
    }
}

class Layer {
    constructor(song, id) {
        this.song = song;
        this.id = id;
        this.name = `Layer ${id + 1}`;
        this.volume = 1;
        this.notes = [];
    }

    setNote(tick, key, instrument) {
        if (tick + 1 > this.song.size) {
            this.song.size = tick + 1;
        }
        const note = new Note(this, tick);
        note.key = key;
        note.instrument = instrument;
        this.notes[tick] = note;
        return note;
    }
}

class Note {
    constructor(layer, tick) {
        this.layer = layer;
        this.tick = tick;
        this.key = 45;
        this.instrument = null;
        this.velocity = 100;
        this.panning = 100;
        this.pitch = 0;
    }
}