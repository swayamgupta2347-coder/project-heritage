// Client-Side Seed Cache & Constants
// Ensures uninterrupted offline functionality and instant previews

window.SEED_CACHE = {
  routes: [
    {
      id: "route-rome-imperial",
      title: "Imperial Rome: The Flavian & Forum Antiquity Trail",
      city: "Rome",
      country: "Italy",
      difficulty: "Moderate Walk",
      durationMins: 180,
      distanceKm: 4.8,
      theme: "Classical Antiquity & Architecture",
      unescoStatus: "World Heritage Site (Historic Centre of Rome, 1980)",
      coverImage: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1200&q=80",
      description: "Walk the historic axis of the Roman Empire, spanning the gladiatorial Colosseum, the Senate chambers of the Roman Forum, the monumental dome of the Pantheon, and Hadrian's imperial mausoleum along the Tiber River.",
      rating: 4.9,
      tags: ["UNESCO", "Roman Empire", "3D LiDAR", "Audio Guide"],
      centerCoords: [41.8902, 12.4922],
      landmarks: ["landmark-colosseum", "landmark-arch-titus-forum", "landmark-pantheon", "landmark-castel-santangelo"]
    },
    {
      id: "route-delhi-mughal",
      title: "The Golden Triangle: Mughal & Rajput Dynastic Path",
      city: "Delhi & Agra",
      country: "India",
      difficulty: "Easy Walk",
      durationMins: 240,
      distanceKm: 6.2,
      theme: "Mughal Architecture & Sacred Gardens",
      unescoStatus: "World Heritage Sites (1983, 1993, 2007)",
      coverImage: "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1200&q=80",
      description: "Trace the architectural flowering of the Mughal Dynasty from the imposing red sandstone bastions of Lal Qila (Red Fort) in Shahjahanabad, to the serene Charbagh gardens of Humayun's Tomb, and the peerless white marble masterpiece of the Taj Mahal.",
      rating: 4.95,
      tags: ["UNESCO", "Mughal Empire", "Symmetric Gardens", "AR Reconstruction"],
      centerCoords: [28.6562, 77.2410],
      landmarks: ["landmark-red-fort", "landmark-humayun-tomb", "landmark-qutb-minar", "landmark-taj-mahal"]
    },
    {
      id: "route-kyoto-zen",
      title: "The Ancient Capital: Kyoto Imperial & Zen Temple Trail",
      city: "Kyoto",
      country: "Japan",
      difficulty: "Moderate Walk",
      durationMins: 210,
      distanceKm: 5.5,
      theme: "Zen Buddhism & Heian Court Heritage",
      unescoStatus: "Historic Monuments of Ancient Kyoto (UNESCO 1994)",
      coverImage: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80",
      description: "Immerse in Japan's thousand-year imperial capital through sacred cedar forests, the shimmering gold leaf pavilion of Kinkaku-ji, the endless vermilion torii gates of Fushimi Inari, and the cantilevered wooden temple veranda of Kiyomizu-dera.",
      rating: 4.92,
      tags: ["UNESCO", "Zen Gardens", "Heian Period", "Spatial Audio"],
      centerCoords: [35.0394, 135.7292],
      landmarks: ["landmark-kinkaku-ji", "landmark-fushimi-inari", "landmark-kiyomizu-dera"]
    },
    {
      id: "route-cairo-pharaohs",
      title: "The Pharaohs & Islamic Cairo Trail",
      city: "Cairo & Giza",
      country: "Egypt",
      difficulty: "Full Day Exploration",
      durationMins: 300,
      distanceKm: 8.0,
      theme: "Ancient Dynasties & Mamluk Architecture",
      unescoStatus: "Memphis and its Necropolis & Islamic Cairo (UNESCO 1979)",
      coverImage: "https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?auto=format&fit=crop&w=1200&q=80",
      description: "Marvel at monumental human engineering across four millennia: from the astronomical precision of Khufu's Great Pyramid and the enigmatic Great Sphinx on the Giza Plateau, to the towering four-iwan courtyard of the 14th-century Sultan Hassan Mosque.",
      rating: 4.88,
      tags: ["UNESCO", "7 Wonders", "LiDAR Orthophoto", "Voice Narrated"],
      centerCoords: [29.9792, 31.1342],
      landmarks: ["landmark-pyramid-khufu", "landmark-great-sphinx", "landmark-sultan-hassan"]
    }
  ]
};
