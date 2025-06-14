import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/authStore";
import { Music2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import api from "@/lib/axios";
import toast from "react-hot-toast";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const isInRoom = location.pathname.startsWith("/room/");

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) {
      toast.error("Please enter a room name");
      return;
    }

    try {
      setIsCreating(true);
      const response = await api.post("/rooms/create", {
        creator: user?._id,
        name: newRoomName,
      });

      // Join the room immediately after creation
      await api.post(`/rooms/join/${response.data.room._id}`);
      
      toast.success("Room created successfully!");
      setIsCreateDialogOpen(false);
      setNewRoomName("");
      navigate(`/room/${response.data.room._id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create room");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <nav className="bg-[#121212] border-b border-gray-800 fixed w-full top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="h-16 flex items-center justify-between">
            <div
              className="flex items-center space-x-2 cursor-pointer"
              onClick={() => navigate("/")}
            >
              <Music2 className="h-6 w-6 text-[#FF007F]" />
              <h1 className="text-xl font-bold text-[#E0E0E0]">Muzz</h1>
            </div>
            <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-opacity-75 rounded-lg inline-block">
              <p className="text-[#FF007F] font-medium animate-pulse">
                Under Development • May Experience Bugs
              </p>
            </div>

            <div className="flex items-center gap-4">
              {!isInRoom && (
                <Button
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="w-[2rem] md:w-[3rem] flex md:w-[10rem]"
                >
                  <Plus className="h-2 w-2 mr-0 md:h-4 md:w-4" />
                  <span className="hidden md:block">Create Room</span>
                </Button>
              )}
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-[#00FFFF] rounded-full"></div>
                <span className="text-sm text-[#E0E0E0]">
                  Welcome, {user?.username}
                </span>
              </div>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="hover:bg-red-900/20 hover:text-red-400 hover:border-red-400"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Room</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Enter room name"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateRoom();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateRoom} disabled={isCreating}>
              {isCreating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Navbar;
