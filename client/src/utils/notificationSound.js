// Notification sound utility for new orders
class NotificationSound {
  constructor() {
    this.audio = null;
    this.isEnabled = true;
    this.volume = 0.7;
    this.initializeAudio();
  }

  // Generate a simple notification beep sound
  generateBeepSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // 800 Hz tone
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.volume, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
    
    return new Promise((resolve) => {
      oscillator.onended = () => {
        audioContext.close();
        resolve();
      };
    });
  }

  initializeAudio() {
    try {
      // Check if running in Electron desktop app
      const isElectron = window.electronAPI !== undefined;
      
      // Use appropriate sound file path
      const soundPath = isElectron ? 'app-sounds://new-order.wav' : '/sounds/new-order.wav';
      
      // Try to load the WAV file first, fallback to generated sound
      this.audio = new Audio(soundPath);
      this.audio.volume = this.volume;
      this.audio.preload = 'auto';
      
      // Handle audio loading errors - fallback to generated sound
      this.audio.addEventListener('error', (e) => {
        console.warn('WAV notification sound failed to load, using generated beep:', e);
        this.audio = null; // Will use generated sound instead
      });

      // Preload the audio file
      this.audio.load();
    } catch (error) {
      console.warn('Audio not supported or failed to initialize, using generated beep:', error);
      this.audio = null; // Will use generated sound instead
    }
  }

  // Play notification sound for new order
  async playNewOrderSound() {
    if (!this.isEnabled) {
      return false;
    }

    try {
      // Try WAV file first
      if (this.audio && this.audio.readyState >= 2) {
        // Reset audio to beginning
        this.audio.currentTime = 0;
        this.audio.volume = this.volume;
        
        // Play the sound
        const playPromise = this.audio.play();
        
        if (playPromise !== undefined) {
          await playPromise;
          console.log('New order notification sound (WAV) played');
          return true;
        }
      } else {
        // Fallback to generated beep sound
        await this.generateBeepSound();
        console.log('New order notification sound (generated beep) played');
        return true;
      }
    } catch (error) {
      console.warn('Failed to play notification sound:', error);
      
      // Final fallback - try generated beep
      try {
        await this.generateBeepSound();
        console.log('New order notification sound (fallback beep) played');
        return true;
      } catch (beepError) {
        console.warn('Failed to play fallback beep:', beepError);
        return false;
      }
    }
    
    return false;
  }

  // Enable/disable notifications
  setEnabled(enabled) {
    this.isEnabled = enabled;
    localStorage.setItem('notificationSoundEnabled', enabled.toString());
  }

  // Get current enabled state
  getEnabled() {
    const stored = localStorage.getItem('notificationSoundEnabled');
    return stored !== null ? stored === 'true' : true;
  }

  // Set volume (0.0 to 1.0)
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.audio) {
      this.audio.volume = this.volume;
    }
    localStorage.setItem('notificationSoundVolume', this.volume.toString());
  }

  // Get current volume
  getVolume() {
    const stored = localStorage.getItem('notificationSoundVolume');
    return stored !== null ? parseFloat(stored) : 0.7;
  }

  // Test the notification sound
  testSound() {
    return this.playNewOrderSound();
  }

  // Initialize with user interaction (call this on first user click)
  enableWithUserInteraction() {
    if (this.isEnabled) {
      // Try to enable audio context for generated sounds
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') {
          audioContext.resume().then(() => {
            console.log('Audio context enabled with user interaction');
            audioContext.close();
          });
        }
      } catch (error) {
        console.warn('Failed to enable audio context:', error);
      }

      // Also try to enable WAV audio if available
      if (this.audio) {
        this.audio.play().then(() => {
          this.audio.pause();
          this.audio.currentTime = 0;
          console.log('WAV audio enabled with user interaction');
        }).catch((error) => {
          console.warn('Failed to enable WAV audio:', error);
        });
      }
    }
  }
}

// Create singleton instance
const notificationSound = new NotificationSound();

// Auto-enable on first user interaction
let userInteractionEnabled = false;
const enableAudioOnInteraction = () => {
  if (!userInteractionEnabled) {
    notificationSound.enableWithUserInteraction();
    userInteractionEnabled = true;
    
    // Remove listeners after first interaction
    document.removeEventListener('click', enableAudioOnInteraction);
    document.removeEventListener('keydown', enableAudioOnInteraction);
    document.removeEventListener('touchstart', enableAudioOnInteraction);
  }
};

// Add event listeners for user interaction
document.addEventListener('click', enableAudioOnInteraction);
document.addEventListener('keydown', enableAudioOnInteraction);
document.addEventListener('touchstart', enableAudioOnInteraction);

export default notificationSound;