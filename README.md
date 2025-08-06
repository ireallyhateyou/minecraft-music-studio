# Minecraft Music Studio

A web-based music composition tool designed for creating Minecraft Note Block songs. Create, edit, and share your musical compositions with an intuitive piano roll interface.

## 🎵 Features

### **Core Functionality**
- **Piano Roll Editor**: Visual note placement with real-time playback
- **Multiple Tracks**: Create complex arrangements with different instruments
- **Real-time Playback**: Hear your music as you compose
- **NBS Import/Export**: Compatible with Minecraft Note Block Studio files
- **Undo/Redo**: Full history support for all edits

### **Sharing & Collaboration**
- **URL Sharing**: Share songs via URL with base64 encoded data
- **Song Library**: Built-in default songs to get started
- **Social Media Integration**: Share directly to Twitter, Discord, and Reddit
- **Copy/Paste**: Select and copy note patterns between projects

### **User Experience**
- **Keyboard Shortcuts**: Full keyboard control for power users
- **Status Bar**: Real-time position, track, and note count
- **Grid Resizing**: Dynamic grid size adjustment (16-128 ticks)
- **Mobile Responsive**: Works on desktop and mobile devices
- **Visual Selection**: Clear selection feedback with dashed borders

## 🎹 Instruments

The studio supports all Minecraft Note Block instruments:
- **Harp** (Default/Any blocks)
- **Bass** (Wood)
- **Bass Drum** (Stone, Blackstone, etc.)
- **Snare Drum** (Sand, Gravel, Concrete Powder)
- **Clicks and Sticks** (Glass, Sea Lantern, Beacon)
- **Guitar** (Wool)
- **Flute** (Clay, Honeycomb Block)
- **Bell** (Block of Gold)
- **Chime** (Packed Ice)
- **Xylophone** (Bone Block)
- **Iron Xylophone** (Block of Iron)
- **Cow Bell** (Soul Sand)
- **Didgeridoo** (Pumpkin)
- **Bit** (Block of Emerald)
- **Banjo** (Hay Bale)
- **Pling** (Glowstone)
- **Skeleton** (Skeleton Skull)
- **Wither Skeleton** (Wither Skeleton Skull)
- **Zombie** (Zombie Head)
- **Creeper** (Creeper Head)
- **Piglin** (Piglin Head)
- **Ender Dragon** (Dragon Head)

## ⌨️ Keyboard Shortcuts

### **Playback**
- `Space` - Play/Pause
- `R` - Stop
- `←/→` - Navigate ticks
- `Home/End` - Go to start/end

### **Editing**
- `Delete` - Clear selection
- `Ctrl+A` - Select all
- `Ctrl+Z/Y` - Undo/Redo
- `Ctrl+C/V` - Copy/Paste

### **Navigation**
- `F` - Toggle full view

## 📤 Sharing Songs

### **URL Sharing**
1. Click the 📤 button in the header
2. Copy the generated URL
3. Share the URL with others
4. Recipients can open the URL to load your song

### **Social Media**
- **Twitter**: Share directly to Twitter with song info
- **Discord**: Share to Discord servers
- **Reddit**: Submit to Reddit communities

### **Song Library**
- **NBS Files**: Automatically loads songs from `assets/songs/*.nbs`
- **Shared Songs**: Songs loaded from URLs appear here
- **Quick Load**: Click any song card to load it instantly
- **Dynamic Loading**: Songs are loaded from the file system

## 🎼 Song Library

The application automatically loads NBS files from the `assets/songs/` directory:

### **Adding Songs**
1. Place `.nbs` files in the `assets/songs/` directory
2. Update the `assets/songs/index.json` file to include the new song filenames
3. Refresh the application to see new songs

**Note**: For GitHub Pages deployment, manually update the `index.json` file when adding new songs.

### **Current Songs**
- **Megalovania - Super Smash Bros. Ultimate**: Complex arrangement from Undertale
- **Nyan Cat**: Popular internet meme song
- **Fallback Songs**: Simple examples if no NBS files are found

## 📱 Mobile Support

The studio is fully responsive and works on mobile devices:
- Touch-friendly interface
- Optimized for small screens
- Gesture support for note placement
- Mobile-specific controls

## 🔧 Technical Details

- **Audio Engine**: Web Audio API for real-time synthesis
- **File Format**: NBS (Note Block Studio) compatibility
- **Compression**: Base64 encoding with JSON compression
- **Browser Support**: Modern browsers with Web Audio API support

## �� Getting Started

1. **Open the Studio**: Load the application in your browser
2. **Choose a Song**: Select from the library or start with a blank canvas
3. **Add Notes**: Click on the grid to place notes
4. **Change Instruments**: Use the instrument selector
5. **Adjust Tempo**: Modify the BPM slider
6. **Play**: Use the playback controls to hear your creation
7. **Share**: Generate a URL to share your song

## 📄 License

This project is open source and available under the MIT License.

---

**Happy composing!** 🎵