import React, { useState, useEffect, useMemo } from 'react';
import { Participant } from 'livekit-client';
import { Layers, X, Plus, Trash2, Edit2, Play, Square, Loader2, UserPlus, UserMinus, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { meetingClientService } from '@/services/client/meeting.service';
import { IBreakoutRoom } from '@/types';
import { toast } from 'sonner';

export interface BreakoutRoomsPanelProps {
  meetingId: string;
  participants: Participant[];
  onClose: () => void;
}

export default function BreakoutRoomsPanel({ meetingId, participants, onClose }: BreakoutRoomsPanelProps) {
  const [rooms, setRooms] = useState<IBreakoutRoom[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Phase 4 New States
  const [searchQuery, setSearchQuery] = useState('');
  const [participantSearchQuery, setParticipantSearchQuery] = useState('');
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  
  const [roomToDelete, setRoomToDelete] = useState<string | null>(null);

  const fetchRooms = async (showToast = false) => {
    try {
      setLoading(true);
      const data = await meetingClientService.getBreakoutRooms(meetingId);
      setRooms(data.breakoutRooms);
      setIsActive(data.breakoutRoomsActive);
      if (showToast) toast.success('Rooms refreshed');
    } catch (err) {
      toast.error('Failed to load breakout rooms: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  const assignedParticipantIds = useMemo(() => {
    const ids = new Set<string>();
    rooms.forEach(r => r.participants.forEach(p => ids.add(p.toString())));
    return ids;
  }, [rooms]);

  const unassignedParticipants = useMemo(() => {
    return participants.filter(p => !assignedParticipantIds.has(p.identity));
  }, [participants, assignedParticipantIds]);

  const filteredRooms = useMemo(() => {
    if (!searchQuery.trim()) return rooms;
    return rooms.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [rooms, searchQuery]);

  const filteredUnassignedParticipants = useMemo(() => {
    if (!participantSearchQuery.trim()) return unassignedParticipants;
    return unassignedParticipants.filter(p => {
      const name = p.name || p.identity;
      return name.toLowerCase().includes(participantSearchQuery.toLowerCase());
    });
  }, [unassignedParticipants, participantSearchQuery]);

  const handleAddRoom = async () => {
    if (!newRoomName.trim()) {
      toast.error('Room name cannot be empty');
      return;
    }
    setIsUpdating(true);
    try {
      const newRoom = { id: `room-${Date.now()}`, name: newRoomName.trim() };
      const updatedRoomsConfig = [...rooms, newRoom].map(r => ({ id: r.id, name: r.name }));
      const newRoomsList = await meetingClientService.createBreakoutRooms(meetingId, updatedRoomsConfig);
      setRooms(newRoomsList);
      setIsActive(false);
      setIsCreateModalOpen(false);
      setNewRoomName('');
      toast.success('Room created successfully');
    } catch (err) {
      toast.error('Failed to create room: ' + (err as Error).message);
    } finally {
      setIsUpdating(false);
    }
  };

  const confirmDeleteRoom = (roomId: string) => {
    if (isActive && rooms.length === 1) {
      toast.error('Cannot delete the last room while breakout is active.');
      return;
    }
    setRoomToDelete(roomId);
  };

  const handleDeleteRoom = async () => {
    if (!roomToDelete) return;
    setIsUpdating(true);
    try {
      const updatedRoomsConfig = rooms.filter(r => r.id !== roomToDelete).map(r => ({ id: r.id, name: r.name }));
      const newRoomsList = await meetingClientService.createBreakoutRooms(meetingId, updatedRoomsConfig);
      setRooms(newRoomsList);
      setIsActive(false); 
      toast.success('Room deleted');
    } catch (err) {
      toast.error('Failed to delete room: ' + (err as Error).message);
    } finally {
      setIsUpdating(false);
      setRoomToDelete(null);
    }
  };

  const handleRenameSubmit = async (roomId: string) => {
    if (!editName.trim()) {
      setEditingRoomId(null);
      return;
    }
    setIsUpdating(true);
    try {
      const updatedRoomsConfig = rooms.map(r => r.id === roomId ? { id: r.id, name: editName.trim() } : { id: r.id, name: r.name });
      const newRoomsList = await meetingClientService.createBreakoutRooms(meetingId, updatedRoomsConfig);
      setRooms(newRoomsList);
      setIsActive(false);
      toast.success('Room renamed');
    } catch (err) {
      toast.error('Failed to rename room: ' + (err as Error).message);
    } finally {
      setEditingRoomId(null);
      setIsUpdating(false);
    }
  };

  const handleAssign = async (roomId: string, participantIdentity: string) => {
    setIsUpdating(true);
    try {
      const newRoomsList = await meetingClientService.assignToBreakoutRoom(meetingId, roomId, participantIdentity);
      setRooms(newRoomsList);
      toast.success('Participant assigned');
    } catch (err) {
      toast.error('Failed to assign participant: ' + (err as Error).message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveParticipant = async (participantIdentity: string) => {
    setIsUpdating(true);
    try {
      const newRoomsList = await meetingClientService.assignToBreakoutRoom(meetingId, 'main', participantIdentity);
      setRooms(newRoomsList);
      toast.success('Participant removed from breakout');
    } catch (err) {
      toast.error('Failed to remove participant: ' + (err as Error).message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleStatus = async () => {
    if (rooms.length === 0 && !isActive) {
      toast.error('Create a room first.');
      return;
    }
    setIsUpdating(true);
    try {
      const result = await meetingClientService.updateBreakoutRoomsStatus(meetingId, !isActive);
      setIsActive(result.active);
      toast.success(result.active ? 'Breakout rooms started' : 'Breakout rooms closed');
    } catch (err) {
      toast.error('Failed to change breakout status: ' + (err as Error).message);
    } finally {
      setIsUpdating(false);
    }
  };

  const getParticipantName = (identity: string) => {
    const p = participants.find(p => p.identity === identity);
    if (!p) return identity;
    return p.name?.trim() || identity;
  };

  const makeInitials = (name: string) => name.substring(0, 2).toUpperCase();

  return (
    <aside className="w-full sm:w-80 shrink-0 border-l bg-background flex flex-col fixed inset-y-0 right-0 z-30 sm:static sm:inset-auto sm:z-auto overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0 bg-muted/20">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-500" />
          <span className="font-semibold text-sm">Breakout Rooms</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchRooms(true)} disabled={loading || isUpdating} className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Refresh list">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading && !rooms.length ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm">Loading rooms...</span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto flex flex-col relative">
          
          {/* Create Room Modal Overlay */}
          {isCreateModalOpen && (
            <div className="absolute inset-0 z-40 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-card border shadow-lg rounded-lg w-full max-w-sm p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Create Breakout Room</h3>
                  <button onClick={() => setIsCreateModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Room Name</label>
                  <Input 
                    autoFocus 
                    placeholder="e.g. Brainstorming Group" 
                    value={newRoomName} 
                    onChange={e => setNewRoomName(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && handleAddRoom()}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleAddRoom} disabled={isUpdating || !newRoomName.trim()}>Create</Button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation Overlay */}
          {roomToDelete && (
            <div className="absolute inset-0 z-40 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-card border shadow-lg rounded-lg w-full max-w-sm p-4 space-y-4">
                <h3 className="font-semibold text-sm text-destructive">Delete Room?</h3>
                <p className="text-xs text-muted-foreground">Are you sure you want to delete this breakout room? Participants assigned to this room will be returned to the unassigned list.</p>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setRoomToDelete(null)}>Cancel</Button>
                  <Button variant="destructive" size="sm" onClick={handleDeleteRoom} disabled={isUpdating}>Delete</Button>
                </div>
              </div>
            </div>
          )}

          {/* Status Controls */}
          <div className="p-4 border-b space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Status:</span>
              {isActive ? (
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded">Active</span>
              ) : (
                <span className="text-xs font-semibold text-amber-600 bg-amber-500/10 px-2 py-1 rounded">Not Started</span>
              )}
            </div>
            
            <Button 
              className={`w-full ${isActive ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
              onClick={handleToggleStatus}
              disabled={isUpdating || (rooms.length === 0 && !isActive)}
            >
              {isUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : (isActive ? <Square className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />)}
              {isActive ? 'Close Breakout Rooms' : 'Start Breakout Rooms'}
            </Button>
          </div>

          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Rooms ({filteredRooms.length})</h3>
              <Button variant="ghost" size="sm" onClick={() => { setNewRoomName(`Room ${rooms.length + 1}`); setIsCreateModalOpen(true); }} disabled={isActive || isUpdating} className="h-7 px-2">
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-muted-foreground" />
              <Input 
                placeholder="Search rooms..." 
                className="h-7.5 pl-7 text-xs" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {filteredRooms.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No matching rooms.</p>
            ) : (
              <div className="space-y-3">
                {filteredRooms.map(room => (
                  <div key={room.id} className="border rounded-md bg-muted/10 overflow-hidden">
                    <div className="flex items-center justify-between p-2 bg-muted/30 border-b">
                      {editingRoomId === room.id ? (
                        <Input 
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleRenameSubmit(room.id)}
                          onBlur={() => handleRenameSubmit(room.id)}
                          autoFocus
                          className="h-7 text-sm py-1"
                        />
                      ) : (
                        <span className="text-sm font-medium truncate flex-1">{room.name}</span>
                      )}
                      
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {!isActive && editingRoomId !== room.id && (
                          <button onClick={() => { setEditingRoomId(room.id); setEditName(room.name); }} className="p-1 text-muted-foreground hover:text-foreground" disabled={isUpdating}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {!isActive && (
                          <button onClick={() => confirmDeleteRoom(room.id)} className="p-1 text-muted-foreground hover:text-destructive" disabled={isUpdating}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-2 space-y-1">
                      {room.participants.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic py-1 px-1">Empty</p>
                      ) : (
                        room.participants.map(pid => {
                          const identity = pid.toString();
                          const pName = getParticipantName(identity);
                          return (
                            <div key={identity} className="flex items-center justify-between gap-2 px-1 py-1 rounded hover:bg-muted/50 group">
                              <div className="flex items-center gap-2 truncate">
                                <Avatar className="w-5 h-5 shrink-0">
                                  <AvatarFallback className="text-[9px]">{makeInitials(pName)}</AvatarFallback>
                                </Avatar>
                                <span className="text-xs truncate">{pName}</span>
                              </div>
                              <button 
                                onClick={() => handleRemoveParticipant(identity)} 
                                disabled={isUpdating}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-opacity"
                                title="Remove from room"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })
                      )}
                      
                      {unassignedParticipants.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger className="w-full justify-start h-7 mt-1 text-xs text-muted-foreground hover:text-foreground flex items-center rounded-md px-2 py-1 hover:bg-muted/50">
                            <UserPlus className="w-3.5 h-3.5 mr-2" /> Assign participant...
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-48">
                            {unassignedParticipants.map(up => (
                              <DropdownMenuItem 
                                key={up.identity} 
                                onClick={() => handleAssign(room.id, up.identity)}
                                disabled={isUpdating}
                              >
                                {up.name || up.identity}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t mt-auto shrink-0 bg-background">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3">Unassigned ({filteredUnassignedParticipants.length})</h3>
            
            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-muted-foreground" />
              <Input 
                placeholder="Search participants..." 
                className="h-7.5 pl-7 text-xs" 
                value={participantSearchQuery}
                onChange={(e) => setParticipantSearchQuery(e.target.value)}
              />
            </div>

            {filteredUnassignedParticipants.length === 0 ? (
              <p className="text-sm text-muted-foreground">No participants found.</p>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {filteredUnassignedParticipants.map(up => (
                  <div key={up.identity} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/40">
                    <Avatar className="w-6 h-6 shrink-0">
                      <AvatarFallback className="text-[10px]">{makeInitials(up.name || up.identity)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm truncate">{up.name || up.identity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
