// ==========================================================================
// Spatial Audio Storytelling Module (izi.TRAVEL inspired)
// Web Speech API synthesis with multilingual voice support & transcript syncing
// ==========================================================================

const AudioGuide = {
  currentLandmark: null,
  isPlaying: false,
  currentTime: 0,
  duration: 120,
  playbackRate: 1.0,
  timerId: null,
  speechUtterance: null,
  availableVoices: [],
  selectedVoice: null,

  init() {
    this.populateVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => this.populateVoices();
    }
  },

  populateVoices() {
    if (!('speechSynthesis' in window)) return;
    this.availableVoices = window.speechSynthesis.getVoices();
    const select = document.getElementById('voice-select');
    if (!select) return;

    select.innerHTML = '<option value="default">Default Natural Voice</option>';
    this.availableVoices.forEach((v, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `${v.name} (${v.lang})`;
      select.appendChild(opt);
    });
  },

  setVoice(index) {
    if (index === 'default' || !this.availableVoices[index]) {
      this.selectedVoice = null;
    } else {
      this.selectedVoice = this.availableVoices[index];
    }
  },

  loadTrack(landmarkId) {
    const landmark = App.state.landmarks.find(l => l.id === landmarkId);
    if (!landmark) return;

    this.currentLandmark = landmark;
    this.currentTime = 0;
    this.duration = landmark.audioDurationSec || 120;
    this.isPlaying = false;

    // Show floating bottom dock
    const dock = document.getElementById('audio-dock');
    if (dock) dock.classList.remove('hidden');

    // Update Dock Meta
    document.getElementById('dock-thumb').textContent = landmark.character?.avatar || '🏛️';
    document.getElementById('dock-title').textContent = landmark.audioTitle || landmark.name;
    document.getElementById('dock-subtitle').textContent = `Narration by ${landmark.character?.name || 'Curator'} (${landmark.yearBuilt})`;
    document.getElementById('dock-total-time').textContent = this.formatTime(this.duration);
    document.getElementById('dock-current-time').textContent = '00:00';
    document.getElementById('dock-progress-fill').style.width = '0%';

    // Auto-start play
    this.play();
  },

  togglePlay() {
    if (this.isPlaying) this.pause();
    else this.play();
  },

  play() {
    if (!this.currentLandmark) return;
    this.isPlaying = true;
    document.getElementById('dock-play-btn').textContent = '⏸';
    document.getElementById('dock-subtitle').textContent = `Playing • ${this.playbackRate}x speed`;

    // Start Web Speech Synthesis
    this.speakScript(this.currentLandmark.audioScript);

    // Progress Timer
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = setInterval(() => {
      this.currentTime += 1;
      this.updateProgress();

      if (this.currentTime >= this.duration) {
        this.onComplete();
      }
    }, 1000 / this.playbackRate);

    App.trackEvent('audio_play', this.currentLandmark.id);
  },

  pause() {
    this.isPlaying = false;
    document.getElementById('dock-play-btn').textContent = '▶';
    document.getElementById('dock-subtitle').textContent = 'Narration paused';
    if (this.timerId) clearInterval(this.timerId);

    if ('speechSynthesis' in window) {
      window.speechSynthesis.pause();
    }
  },

  speakScript(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel(); // Stop existing

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this.playbackRate;
    utterance.pitch = 1.0;

    // Match language
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    } else {
      const langMap = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', hi: 'hi-IN', it: 'it-IT', ja: 'ja-JP' };
      const targetLang = langMap[App.state.currentLang] || 'en-US';
      const match = this.availableVoices.find(v => v.lang.startsWith(targetLang.substring(0, 2)));
      if (match) utterance.voice = match;
    }

    this.speechUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  },

  skipSeconds(secs) {
    this.currentTime = Math.max(0, Math.min(this.duration, this.currentTime + secs));
    this.updateProgress();
    if (this.isPlaying) {
      this.play();
    }
  },

  seekFromBar(e) {
    const bar = document.getElementById('dock-progress-bar');
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    this.currentTime = Math.round(ratio * this.duration);
    this.updateProgress();
  },

  cycleSpeed() {
    const speeds = [0.75, 1.0, 1.25, 1.5];
    const idx = speeds.indexOf(this.playbackRate);
    this.playbackRate = speeds[(idx + 1) % speeds.length];
    document.getElementById('dock-speed-btn').textContent = `${this.playbackRate}x`;
    if (this.isPlaying) {
      this.play();
    }
    App.showToast(`Audio playback speed: ${this.playbackRate}x`);
  },

  updateProgress() {
    const pct = (this.currentTime / this.duration) * 100;
    const fill = document.getElementById('dock-progress-fill');
    if (fill) fill.style.width = `${pct}%`;

    const currEl = document.getElementById('dock-current-time');
    if (currEl) currEl.textContent = this.formatTime(this.currentTime);

    // Sync modal transcript highlights
    this.highlightTranscriptSentence();
  },

  onComplete() {
    this.pause();
    this.currentTime = 0;
    this.updateProgress();
    App.showToast(`🎧 Audio Tour for ${this.currentLandmark?.name} Completed!`);
    App.trackEvent('audio_complete', this.currentLandmark?.id);
  },

  closeDock() {
    this.pause();
    const dock = document.getElementById('audio-dock');
    if (dock) dock.classList.add('hidden');
  },

  formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  },

  expandModal() {
    if (!this.currentLandmark) return;
    const modal = document.getElementById('audio-modal-backdrop');
    if (!modal) return;

    document.getElementById('transcript-modal-title').textContent = this.currentLandmark.name;
    
    // Character Bio Box
    const char = this.currentLandmark.character;
    document.getElementById('modal-character-voice').innerHTML = `
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
        <span style="font-size:32px;">${char?.avatar || '🏛️'}</span>
        <div>
          <h4 style="font-size:15px; color:#FFF; font-weight:600;">${char?.name || 'Historical Voice'}</h4>
          <span style="font-size:12px; color:var(--gold-primary);">${char?.title || 'Historical Guide'}</span>
        </div>
      </div>
      <p style="font-style:italic; font-size:13.5px; color:var(--text-gold); background:rgba(255,255,255,0.03); padding:10px; border-radius:6px;">
        "${char?.introQuote || 'Listen closely to the chronicles carved into stone.'}"
      </p>
    `;

    // Split audio script into individual sentences for synchronized highlight
    const sentences = (this.currentLandmark.audioScript || '').split(/(?<=[.?!])\s+/);
    const textContainer = document.getElementById('modal-transcript-text');
    textContainer.innerHTML = sentences.map((s, idx) => `
      <span class="transcript-sentence" id="sentence-${idx}">${s}</span>
    `).join(' ');

    modal.classList.remove('hidden');
  },

  highlightTranscriptSentence() {
    if (!this.currentLandmark) return;
    const sentences = (this.currentLandmark.audioScript || '').split(/(?<=[.?!])\s+/);
    if (!sentences.length) return;

    const sentenceIndex = Math.min(
      sentences.length - 1,
      Math.floor((this.currentTime / this.duration) * sentences.length)
    );

    document.querySelectorAll('.transcript-sentence').forEach((el, idx) => {
      el.classList.toggle('highlight', idx === sentenceIndex);
    });
  },

  closeModal(e) {
    if (e && e.target && e.target.id !== 'audio-modal-backdrop' && !e.target.classList.contains('modal-close')) return;
    const modal = document.getElementById('audio-modal-backdrop');
    if (modal) modal.classList.add('hidden');
  },

  speakDirect(text, voiceName = null, lang = 'en') {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#_`]/g, '');
    const ut = new SpeechSynthesisUtterance(cleanText);
    ut.rate = this.playbackRate || 1.0;
    if (this.selectedVoice) {
      ut.voice = this.selectedVoice;
    } else if (this.availableVoices.length > 0) {
      const match = this.availableVoices.find(v => v.lang.toLowerCase().startsWith(lang.toLowerCase()));
      if (match) ut.voice = match;
    }
    window.speechSynthesis.speak(ut);
  }
};

window.AudioGuide = AudioGuide;
