import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useRoomStore } from "@/store/roomStore";
import { useAuthStore } from "@/store/authStore";
import { socket } from "@/lib/socket";
import { useParams } from "react-router-dom";
import { SkipForward, Pause, Play, Volume2, VolumeX } from "lucide-react";
import api from "@/lib/axios";
import { toast } from "react-hot-toast";
// import { debounce } from "lodash";

// Helper function to format time
const formatTime = (seconds: number): string => {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

// Add at the top of the file, after imports
interface PlaybackState {
  currentTime: number;
  isPlaying: boolean;
  currentSong: {
    _id: string;
    title: string;
    artist: string;
    url: string;
    duration: number;
    addedBy: string;
    votes: number;
    upvoters: string[];
    downvoters: string[];
    upvotes: number;
    downvotes: number;
    albumName?: string;
  } | null;
}

const MusicPlayer = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const previousVolume = useRef(1);
  const [isRoomCreator, setIsRoomCreator] = useState(false);
  const currentSong = useRoomStore((state) => state.currentSong);
  const setCurrentSong = useRoomStore((state) => state.setCurrentSong);
  const user = useAuthStore((state) => state.user);
  // const syncTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSyncTime = useRef<number>(Date.now());
  const queue = useRoomStore((state) => state.queue);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // Add new ref for tracking user interaction
  const hasUserInteracted = useRef(false);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    const checkRoomCreator = async () => {
      try {
        if (!roomId || !user?._id) return;
        const response = await api.get(`/rooms/${roomId}`);
        const creatorId = response.data.creator._id || response.data.creator;
        setIsRoomCreator(creatorId.toString() === user._id.toString());
      } catch (error) {
        console.error("Failed to check room creator status:", error);
      }
    };

    checkRoomCreator();
  }, [roomId, user?._id]);

  // Add this useEffect to handle user interaction
  useEffect(() => {
    const handleUserInteraction = () => {
      hasUserInteracted.current = true;
      // Remove listeners once we have interaction
      document.removeEventListener("click", handleUserInteraction);
      document.removeEventListener("keydown", handleUserInteraction);
    };

    document.addEventListener("click", handleUserInteraction);
    document.addEventListener("keydown", handleUserInteraction);

    return () => {
      document.removeEventListener("click", handleUserInteraction);
      document.removeEventListener("keydown", handleUserInteraction);
    };
  }, []);

  // Update the currentSong effect
  useEffect(() => {
    if (currentSong && audioRef.current) {
      audioRef.current.src = currentSong.url;
      audioRef.current.load();
      audioRef.current.volume = volume;

      const setupAudio = async () => {
        try {
          if (isPlaying) {
            if (hasUserInteracted.current || isRoomCreator) {
              await audioRef.current?.play();
            } else {
              // Show toast only on initial load
              if (isInitialLoad.current) {
                toast.success("Click anywhere to enable audio playback", {
                  duration: 5000,
                });
                isInitialLoad.current = false;
              }
            }
          }
        } catch (error) {
          console.error("Playback failed:", error);
          setIsPlaying(false);
          if (isRoomCreator) {
            socket.emit("updatePlaybackState", {
              roomId,
              currentTime: audioRef.current?.currentTime || 0,
              isPlaying: false,
              currentSong,
            });
          }
        }
      };

      audioRef.current.addEventListener("canplay", setupAudio);

      return () => {
        if (audioRef.current) {
          audioRef.current.removeEventListener("canplay", setupAudio);
        }
      };
    }
  }, [currentSong, isPlaying, volume, isRoomCreator, roomId]);

  // Update the playback state effect
  useEffect(() => {
    if (roomId) {
      socket.emit("requestPlaybackState", { roomId });

      const handlePlaybackState = async ({
        currentTime,
        isPlaying: newIsPlaying,
        currentSong: newCurrentSong,
      }: PlaybackState) => {
        if (audioRef.current) {
          if (
            newCurrentSong &&
            (!currentSong || newCurrentSong._id !== currentSong._id)
          ) {
            setCurrentSong(newCurrentSong);
            audioRef.current.src = newCurrentSong.url;
            audioRef.current.load();
            audioRef.current.currentTime = currentTime;
            setProgress(currentTime);

            if (newIsPlaying) {
              try {
                const playPromise = audioRef.current.play();
                if (playPromise !== undefined) {
                  playPromise.catch(() => {
                    setAutoplayBlocked(true);
                  });
                }
              } catch (error) {
                console.error("Playback failed:", error);
                setAutoplayBlocked(true);
              }
            }
          } else {
            audioRef.current.currentTime = currentTime;
            setProgress(currentTime);

            if (newIsPlaying !== isPlaying) {
              if (newIsPlaying) {
                try {
                  const playPromise = audioRef.current.play();
                  if (playPromise !== undefined) {
                    playPromise.catch(() => {
                      setAutoplayBlocked(true);
                    });
                  }
                } catch (error) {
                  console.error("Playback failed:", error);
                  setAutoplayBlocked(true);
                }
              } else {
                audioRef.current.pause();
              }
            }
          }

          setIsPlaying(newIsPlaying);
        }
      };

      socket.on("playbackStateUpdate", handlePlaybackState);
      socket.on("roomState", handlePlaybackState);
      socket.on("songAdded", () => {
        socket.emit("requestPlaybackState", { roomId });
      });

      return () => {
        socket.off("playbackStateUpdate");
        socket.off("roomState");
        socket.off("songAdded");
      };
    }
  }, [roomId, currentSong, isPlaying]);

  // Update the user interaction handler
  const handleInteraction = () => {
    hasUserInteracted.current = true;
    if (autoplayBlocked && audioRef.current && isPlaying) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setAutoplayBlocked(false);
          })
          .catch((error) => {
            console.error("Failed to resume playback:", error);
          });
      }
    }
  };

  useEffect(() => {
    window.addEventListener("click", handleInteraction, { once: true });
    window.addEventListener("touchstart", handleInteraction, { once: true });
    window.addEventListener("keydown", handleInteraction, { once: true });

    return () => {
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
  }, [autoplayBlocked, isPlaying]);

  // Add this effect to handle song changes
  useEffect(() => {
    if (currentSong && audioRef.current) {
      audioRef.current.src = currentSong.url;
      audioRef.current.load();
      audioRef.current.volume = volume;

      if (isPlaying) {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            setAutoplayBlocked(true);
          });
        }
      }
    }
  }, [currentSong, volume]);

  useEffect(() => {
    if (!currentSong && queue.length > 0) {
      setCurrentSong(queue[0]);
    }
  }, [queue, currentSong, setCurrentSong]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const currentTime = audioRef.current.currentTime;
      setProgress(currentTime);
      setDuration(audioRef.current.duration);

      // Emit time updates more frequently for better sync
      if (isRoomCreator && Math.abs(currentTime - lastSyncTime.current) > 0.5) {
        lastSyncTime.current = currentTime;
        socket.emit("updatePlaybackTime", { roomId, time: currentTime });
      }
    }
  };

  const handleSongEnd = () => {
    if (currentSong) {
      socket.emit("songEnded", {
        roomId,
        songId: currentSong._id,
        queue, // Send current queue state
      });
    }
  };

  const handleSeek = (value: number) => {
    if (!isRoomCreator || !audioRef.current) return;
    audioRef.current.currentTime = value;
    socket.emit("seekTime", { roomId, time: value });
  };

  // Update the handlePlayPause function
  const handlePlayPause = async () => {
    if (!isRoomCreator) return;

    try {
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          await audioRef.current.play();
          setIsPlaying(true);
        }

        socket.emit("updatePlaybackState", {
          roomId,
          currentTime: audioRef.current.currentTime,
          isPlaying: !isPlaying,
          currentSong,
          duration: audioRef.current.duration,
        });
      }
    } catch (error) {
      console.error("Error handling play/pause:", error);
      toast.error("Failed to play audio. Please try again.");
    }
  };

  const handleSkip = () => {
    if (!isRoomCreator) return;
    socket.emit("skipSong", { roomId });
  };

  const handleVolumeChange = ([value]: number[]) => {
    const newVolume = value / 100;
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    if (newVolume > 0) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = previousVolume.current;
        setVolume(previousVolume.current);
      } else {
        previousVolume.current = volume;
        audioRef.current.volume = 0;
        setVolume(0);
      }
      setIsMuted(!isMuted);
    }
  };

  // Add effect to handle next song events
  useEffect(() => {
    socket.on("nextSong", ({ song, isPlaying: newIsPlaying }) => {
      if (song) {
        setCurrentSong(song);
        setIsPlaying(newIsPlaying);
        setProgress(0);

        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          if (newIsPlaying && (hasUserInteracted.current || isRoomCreator)) {
            audioRef.current.play().catch(() => {
              setAutoplayBlocked(true);
            });
          }
        }
      }
    });

    return () => {
      socket.off("nextSong");
    };
  }, [setCurrentSong, isRoomCreator]);

  // Render UI with dark theme
  return (
    <div className="flex flex-col">
      {/* Autoplay blocked message */}
      {autoplayBlocked && (
        <div className="mb-4 p-3 bg-gray-700 text-yellow-300 rounded-lg">
          <p>
            <strong>Autoplay blocked by browser:</strong> Click the{" "}
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white mx-1"
              onClick={handleInteraction}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </Button>{" "}
            button to start playback.
          </p>
        </div>
      )}

      {/* Song info */}
      <div className="mb-4 text-center">
        {currentSong ? (
          <>
            <h2 className="text-xl font-bold mb-1 text-gray-100">
              {currentSong.title}
            </h2>
            <p className="text-gray-300">
              {currentSong.artist} {currentSong?.albumName && `• ${currentSong.albumName}`}
            </p>
          </>
        ) : (
          <p className="text-gray-300 my-4">No song currently playing</p>
        )}
      </div>

      {/* Controls */}
      <div className="grid grid-cols-12 items-center gap-2 mb-2">
        <div className="col-span-1 text-right">
          <span className="text-sm text-gray-300">
            {formatTime(progress)}
          </span>
        </div>
        <div className="col-span-10">
          <Slider
            value={[progress]}
            max={duration || 100}
            step={1}
            onValueChange={(values) => handleSeek(values[0])}
            disabled={!currentSong}
            className="cursor-pointer"
          />
        </div>
        <div className="col-span-1 text-left">
          <span className="text-sm text-gray-300">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Play/Skip buttons */}
      <div className="flex justify-center items-center gap-4 mb-4">
        <Button
          onClick={handlePlayPause}
          disabled={!currentSong}
          className={`p-2 h-12 w-12 rounded-full ${currentSong ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-600"} text-white`}
        >
          {isPlaying ? <Pause size={24} /> : <Play size={24} />}
        </Button>
        
        <Button
          onClick={handleSkip}
          disabled={!isRoomCreator || queue.length === 0}
          className={`p-2 h-10 w-10 rounded-full ${isRoomCreator && queue.length > 0 ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-600"} text-white`}
        >
          <SkipForward size={20} />
        </Button>
      </div>

      {/* Volume control */}
      <div className="flex items-center justify-center gap-2">
        <Button
          onClick={toggleMute}
          className="p-2 h-8 w-8 bg-transparent hover:bg-gray-700 text-gray-300"
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </Button>
        <div className="w-32">
          <Slider
            value={[isMuted ? 0 : volume * 100]}
            max={100}
            step={1}
            onValueChange={handleVolumeChange}
            className="cursor-pointer"
          />
        </div>
      </div>
      
      <audio ref={audioRef} onTimeUpdate={handleTimeUpdate} onEnded={handleSongEnd} />
    </div>
  );
};

export default MusicPlayer;
