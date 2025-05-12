import { useRoomStore } from '@/store/roomStore';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ThumbsUp, ThumbsDown, Trash2 } from 'lucide-react';
import { socket } from '@/lib/socket';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useEffect, useState } from 'react';
import api from '@/lib/axios';

const Queue = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const queue = useRoomStore((state) => state.queue);
  const currentSong = useRoomStore((state) => state.currentSong);
  const user = useAuthStore((state) => state.user);
  const [isRoomCreator, setIsRoomCreator] = useState(false);

  useEffect(() => {
    const checkRoomCreator = async () => {
      try {
        if (!roomId || !user?._id) return;
        const response = await api.get(`/rooms/${roomId}`);
        const creatorId = response.data.creator._id || response.data.creator;
        setIsRoomCreator(creatorId.toString() === user._id.toString());
      } catch (error) {
        console.error('Failed to check room creator status:', error);
      }
    };

    checkRoomCreator();
  }, [roomId, user?._id]);

  // Filter out the currently playing song from the queue
  const remainingQueue = queue.filter(song => song._id !== currentSong?._id);

  const handleVote = async (songId: string, voteType: 'upvote' | 'downvote') => {
    try {
      if (!user?._id) {
        toast.error('Must be logged in to vote');
        return;
      }
      socket.emit('voteSong', { roomId, songId, voteType, userId: user._id });
    } catch (error) {
      toast.error('Failed to vote');
    }
  };

  const handleDeleteSong = async (songId: string) => {
    try {
      if (!user?._id) {
        toast.error('Must be logged in to delete songs');
        return;
      }
      socket.emit('deleteSong', { roomId, songId, userId: user._id });
    } catch (error) {
      toast.error('Failed to delete song');
    }
  };

  if (remainingQueue.length === 0) {
    return (
      <div className="text-center p-4 text-gray-400">
        No songs in queue
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {remainingQueue.map((song) => (
        <Card key={song._id} className="bg-gray-700 border-gray-600">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <h3 className="font-semibold text-gray-100">{song.title}</h3>
              <p className="text-sm text-gray-400">{song.artist}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-sm text-green-400">+{song.upvotes}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleVote(song._id, 'upvote')}
                  className={song.upvoters?.includes(user?._id ?? '') ? 'bg-green-900/50' : 'hover:bg-gray-600'}
                >
                  <ThumbsUp className={`h-4 w-4 ${song.upvoters?.includes(user?._id ?? '') ? 'text-green-400' : 'text-gray-300'}`} />
                </Button>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm text-red-400">+{song.downvotes}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleVote(song._id, 'downvote')}
                  className={song.downvoters?.includes(user?._id ?? '') ? 'bg-red-900/50' : 'hover:bg-gray-600'}
                >
                  <ThumbsDown className={`h-4 w-4 ${song.downvoters?.includes(user?._id ?? '') ? 'text-red-400' : 'text-gray-300'}`} />
                </Button>
              </div>
              <span className="text-sm text-gray-300 ml-2">Total: {song.votes}</span>
              {(user?._id === song.addedBy || isRoomCreator) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteSong(song._id)}
                  className="text-red-400 hover:text-red-300 hover:bg-gray-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default Queue;