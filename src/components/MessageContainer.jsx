import React, { useEffect, useRef, useState } from "react";
import {
  Flex, Text, Divider, Avatar, useColorModeValue, SkeletonCircle, Skeleton,
  Box, AvatarBadge, IconButton, Menu, MenuButton, MenuList, MenuItem,
  useToast, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody,
  ModalFooter, Button, Tooltip
} from "@chakra-ui/react";
import { useRecoilState, useRecoilValue, useSetRecoilState } from "recoil";
import { selectedConversationAtom, messagesAtom, conversationsAtom } from "../atoms/messageAtom";
import axios from "axios";
import userAtom from "../atoms/userAtom";
import { useSocket } from "../context/SocketContext";
import Message from "./Message";
import MessageInput from "./MessageInput";
import { FiPhone, FiVideo, FiMic, FiMicOff, FiVideoOff } from "react-icons/fi";
import { CiMenuKebab } from "react-icons/ci";
import useWebRTC from "../hooks/useWebRTC";

const API_BASE = import.meta.env.VITE_API_URL || "";
const api = axios.create({ baseURL: API_BASE ? `${API_BASE}/api/v1` : "/api/v1", withCredentials: true });

const LoadingMessageSkeleton = ({ isSender }) => (
  <Flex gap={2} alignItems={"center"} p={1} borderRadius={"md"} alignSelf={isSender ? "flex-end" : "flex-start"}>
    {isSender ? null : <SkeletonCircle size={7} />}
    <Flex flexDir={"column"} gap={2}>
      <Skeleton h="8px" w="250px" />
      <Skeleton h="8px" w="250px" />
      <Skeleton h="8px" w="250px" />
    </Flex>
    {isSender ? <SkeletonCircle size={7} /> : null}
  </Flex>
);

const MessageContainer = () => {
  const [selectedConversation, setSelectedConversation] = useRecoilState(selectedConversationAtom);
  const [messages, setMessages] = useRecoilState(messagesAtom);
  const currentUser = useRecoilValue(userAtom);
  const { socket, onlineUsers } = useSocket();
  const setConversations = useSetRecoilState(conversationsAtom);
  const messageEndRef = useRef(null);
  const toast = useToast();
  const [loadingMessages, setLoadingMessages] = useState(true);

  const isOnline = selectedConversation?.userId && onlineUsers.includes(selectedConversation.userId);

  const {
    isCalling, isCallAccepted, startCall, endCall, userVideo,
    partnerVideo, partnerAudio, caller, isReceivingCall,
    acceptCall, currentCallType, toggleMic, toggleCamera 
  } = useWebRTC();

  // Call Controls State (Local states to manage UI toggles)
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);

  // Call ပြီးဆုံးသွားရင် Toggles တွေရဲ့ State ကို ပြန်ပြီး Reset လုပ်ရန်
  useEffect(() => {
    if (!isCallAccepted && !isCalling && !isReceivingCall) {
        setIsMicEnabled(true);
        setIsCameraEnabled(true);
    }
  }, [isCallAccepted, isCalling, isReceivingCall]);

  useEffect(() => {
    const getMessages = async () => {
      if (!selectedConversation?._id) return;
      setMessages([]);
      setLoadingMessages(true);
      try {
        if (selectedConversation.mock) { setLoadingMessages(false); return; }
        const response = await api.get(`/messages/conversation/${selectedConversation._id}`);
        setMessages(response.data);
      } catch (error) { console.error(error); } finally { setLoadingMessages(false); }
    };
    getMessages();
  }, [selectedConversation._id, selectedConversation.mock, setMessages]);

  useEffect(() => {
    if (!socket) return;

    const handleMessagesSeen = ({ conversationId }) => {
      if (selectedConversation?._id === conversationId) {
        setMessages((prev) => prev.map((m) => (m.sender === currentUser._id
          ? { ...m, seenBy: Array.from(new Set([...(m.seenBy || []), selectedConversation.userId])) }
          : m))
        );
      }
    };

    const handleReceiveNewMessage = (message) => {
      if (selectedConversation?._id === message.conversationId && message.sender !== currentUser._id) {
        // Send seen status back to the server
        api.put(`/messages/seen/${selectedConversation._id}`).catch((err) => console.error("Failed to update seen status:", err));
      }
    };

    socket.on("messagesSeen", handleMessagesSeen);
    socket.on("newMessage", handleReceiveNewMessage);

    return () => {
      socket.off("messagesSeen", handleMessagesSeen);
      socket.off("newMessage", handleReceiveNewMessage);
    };
  }, [socket, selectedConversation, setMessages, currentUser._id, setConversations]);

  useEffect(() => { messageEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loadingMessages]);

  const containerBg = useColorModeValue("white", "gray.800");

  const handleCallStart = (callType) => {
    if (!selectedConversation?.userId) return;
    setIsMicEnabled(true);
    setIsCameraEnabled(true);
    startCall(selectedConversation.userId, callType);
  };

  const handleEndCall = () => { endCall(); };

  const handleRejectCall = () => {
    endCall(true, true);
  };
  
  const handleToggleMic = () => {
    toggleMic(!isMicEnabled);
    setIsMicEnabled(!isMicEnabled);
  };

  const handleToggleCamera = () => {
    toggleCamera(!isCameraEnabled);
    setIsCameraEnabled(!isCameraEnabled);
  };

  return (
    <Flex flex={70} bg={containerBg} borderRadius={"md"} p={4} flexDir={"column"}>
      {/* Header */}
      <Flex w={"full"} h={12} alignItems={"center"} gap={2}>
        <Avatar src={selectedConversation?.userProfilePic?.url || "/no-pic.jpeg"} w={9} h={9}>
          {isOnline && <AvatarBadge boxSize="1em" bg="green.500" />}
        </Avatar>
        <Flex flexDir="column" ml={1}>
          <Text display={"flex"} alignItems={"center"} fontWeight={"bold"}>{selectedConversation?.username}</Text>
          <Text fontSize={"xs"} color={"gray.500"}>{isOnline ? "Online" : "Offline"}</Text>
        </Flex>
        <Flex ml={"auto"} gap={2} alignItems={"center"}>
          {isOnline && (
            <>
              <Tooltip label="Audio Call" hasArrow placement="bottom">
                <IconButton icon={<FiPhone />} aria-label="Audio Call" variant="ghost" size="sm" onClick={() => handleCallStart("audio")} isDisabled={isCalling || isReceivingCall || isCallAccepted} />
              </Tooltip>
              <Tooltip label="Video Call" hasArrow placement="bottom">
                <IconButton icon={<FiVideo />} aria-label="Video Call" variant="ghost" size="sm" onClick={() => handleCallStart("video")} isDisabled={isCalling || isReceivingCall || isCallAccepted} />
              </Tooltip>
            </>
          )}
          <Menu>
            <MenuButton as={IconButton} icon={<CiMenuKebab />} aria-label="Options" variant="ghost" size="sm" />
            <MenuList>
              <MenuItem onClick={() => toast({ title: "Not implemented yet", description: "This feature is not yet available.", status: "info", duration: 3000, isClosable: true })}>
                View Profile
              </MenuItem>
            </MenuList>
          </Menu>
        </Flex>
      </Flex>

      <Divider my={2} />

      {/* Messages */}
      <Flex flexGrow={1} flexDir={"column"} gap={4} overflowY={"auto"} p={4}
        css={{ "&::-webkit-scrollbar": { width: "8px" }, "&::-webkit-scrollbar-thumb": { backgroundColor: useColorModeValue("gray.300", "gray.600"), borderRadius: "4px" } }}>
        {loadingMessages ? (
          <>
            <LoadingMessageSkeleton isSender={false} />
            <LoadingMessageSkeleton isSender={true} />
            <LoadingMessageSkeleton isSender={false} />
          </>
        ) : (
          messages.map((message) => (
            <Flex key={message._id} direction={"column"}>
              <Message message={message} ownMessage={message.sender === currentUser._id} />
            </Flex>
          ))
        )}
        <div ref={messageEndRef} />
      </Flex>

      <MessageInput setMessages={setMessages} />

      {/* Call Modal */}
      <Modal 
        isOpen={isReceivingCall || isCallAccepted || isCalling} 
        onClose={handleEndCall} 
        isCentered
        closeOnOverlayClick={false} 
        closeOnEsc={false} 
        // Video Call Accepted ဆိုရင် Modal ကို ပိုကျယ်အောင် လုပ်ပါ
         size={currentCallType === 'video' && isCallAccepted ? '3xl' : 'md'}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {isReceivingCall ? `Incoming ${currentCallType} call from ${caller.name}` : (isCallAccepted ? `In ${currentCallType} Call` : `Calling ${selectedConversation?.username} (${currentCallType})...`)}
          </ModalHeader>
          <ModalBody>
            <Box position="relative" w="full" h={currentCallType === 'video' ? (isCallAccepted ? '450px' : '300px') : 'auto'}>
              {currentCallType === 'video' ? (
                <Flex direction="column" gap={2} h="full">
                  {/* Remote/Partner Video */}
                    {/* Add a check to ensure partnerVideo ref is available for video call before rendering */}
                  <video 
                    playsInline 
                    ref={partnerVideo} 
                    autoPlay 
                    style={{ 
                        width: "100%", 
                        height: isCallAccepted ? '100%' : '300px', 
                        objectFit: 'cover', 
                        borderRadius: "8px", 
                        border: isCallAccepted ? "1px solid #333" : "none" 
                    }} 
                  />
                  
                  {/* Local User Video (Small, floating style) */}
                  {(isCallAccepted || isCalling) && (
                    <video 
                      playsInline 
                      muted 
                      ref={userVideo} 
                      autoPlay 
                      style={{ 
                        width: "150px", 
                        height: "100px",
                        position: "absolute", 
                        bottom: isCallAccepted ? '10px' : 'auto', 
                        top: isCallAccepted ? 'auto' : '10px', 
                        right: '10px', 
                        borderRadius: "8px", 
                        border: "2px solid white", 
                        zIndex: 10,
                        objectFit: 'cover'
                      }} 
                    />
                  )}
                </Flex>
              ) : (
                <Box textAlign="center" py={10}>
                  <Avatar 
                    size="xl" 
                    name={isReceivingCall ? caller.name : selectedConversation?.username}
                    src={isReceivingCall ? null : selectedConversation?.userProfilePic?.url || "/no-pic.jpeg"}
                  />
                  <Text fontSize="lg" mt={4}>{isReceivingCall ? `Incoming call from ${caller.name}` : (isCallAccepted ? "On a voice call..." : "Connecting...")}</Text>
                </Box>
              )}
              {/* Partner Audio (Hidden) */}
              <audio ref={partnerAudio} autoPlay playsInline style={{ display: "none" }} />
            </Box>
          </ModalBody>
          <ModalFooter display="flex" justifyContent="space-between">
            
            {/* Control Buttons */}
            {(isCallAccepted || isCalling) && (
              <Flex gap={3} alignItems="center">
                {/* Mic Toggle */}
                <Tooltip label={isMicEnabled ? "Mute Mic" : "Unmute Mic"} hasArrow>
                  <IconButton 
                    icon={isMicEnabled ? <FiMic /> : <FiMicOff />} 
                    onClick={handleToggleMic} 
                    isRound={true} 
                    colorScheme={isMicEnabled ? 'gray' : 'red'} 
                    aria-label="Toggle Microphone"
                  />
                </Tooltip>

                {/* Camera Toggle (Video Call only) */}
                {currentCallType === 'video' && (isCallAccepted || isCalling) && (
                  <Tooltip label={isCameraEnabled ? "Disable Camera" : "Enable Camera"} hasArrow>
                    <IconButton 
                      icon={isCameraEnabled ? <FiVideo /> : <FiVideoOff />} 
                      onClick={handleToggleCamera} 
                      isRound={true} 
                      colorScheme={isCameraEnabled ? 'gray' : 'red'} 
                      aria-label="Toggle Camera"
                    />
                  </Tooltip>
                )}
              </Flex>
            )}
            
            {/* Action Buttons */}
            <Flex ml="auto" gap={3}>
              {isReceivingCall && !isCallAccepted && (
                <Button onClick={() => { acceptCall(caller, currentCallType); }} colorScheme="green" mr={3}>Accept</Button>
              )}
              <Button 
                onClick={isReceivingCall && !isCallAccepted ? handleRejectCall : handleEndCall} 
                colorScheme="red"
              >
                {isReceivingCall && !isCallAccepted ? "Reject" : "End Call"}
              </Button>
            </Flex>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Flex>
  );
};

export default MessageContainer;