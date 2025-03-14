import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = 'http://localhost:5000/chat'; // REST API URL
  private socketUrl = 'http://localhost:5000';  // WebSocket Server URL
  private socket: Socket;
  private currentUser: string = '';
  private notificationPermission: boolean = false;

  // BehaviorSubjects for real-time updates
  private messageSubject = new BehaviorSubject<any[]>([]);
  private typingSubject = new BehaviorSubject<{user: string, isTyping: boolean}>({user: '', isTyping: false});
  private onlineUsersSubject = new BehaviorSubject<string[]>([]);

  constructor(private http: HttpClient) {
    // Initialize Socket.IO connection
    this.socket = io(this.socketUrl);
    this.setupSocketListeners();
    this.requestNotificationPermission();
  }

  private async requestNotificationPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      this.notificationPermission = permission === 'granted';
    }
  }

  private showNotification(title: string, body: string) {
    if (this.notificationPermission && document.hidden) {
      new Notification(title, {
        body: body,
        icon: '/assets/chat-icon.png', // You can add an icon image if you have one
      });
    }
  }

  // Initialize socket connection with user info
  initializeSocket(username: string) {
    this.currentUser = username;
    this.socket.emit('user_connected', { username });
  }

  private setupSocketListeners() {
    // Private message listener
    this.socket.on('receive_private_message', (message: any) => {
      const currentMessages = this.messageSubject.value;
      if (!currentMessages.some(msg => 
        msg.sender === message.sender && 
        msg.receiver === message.receiver &&
        msg.message === message.message && 
        new Date(msg.timestamp).getTime() === new Date(message.timestamp).getTime()
      )) {
        // Show notification for new private messages
        if (message.sender !== this.currentUser) {
          this.showNotification(
            `New message from ${message.sender}`,
            message.message
          );
        }
        this.messageSubject.next([...currentMessages, message]);
      }
    });

    // Group message listener
    this.socket.on('receive_group_message', (message: any) => {
      const currentMessages = this.messageSubject.value;
      if (!currentMessages.some(msg => 
        msg.sender === message.sender && 
        msg.group === message.group &&
        msg.message === message.message && 
        new Date(msg.timestamp).getTime() === new Date(message.timestamp).getTime()
      )) {
        // Set isRead to false for new messages not from current user
        if (message.sender !== this.currentUser) {
          message.isRead = false;
          // Show notification for new group messages
          this.showNotification(
            `New message in ${message.group}`,
            `${message.sender}: ${message.message}`
          );
        }
        this.messageSubject.next([...currentMessages, message]);
      }
    });

    // Typing indicators
    this.socket.on('user_typing', (data: any) => {
      this.typingSubject.next({ user: data.sender, isTyping: true });
    });

    this.socket.on('userStoppedTyping', (data: any) => {
      this.typingSubject.next({ user: data.sender, isTyping: false });
    });

    // Online users
    this.socket.on('users_online', (users: string[]) => {
      this.onlineUsersSubject.next(users);
    });
  }

  /**  Fetch all users */
  getUsers(): Observable<any[]> {
    return this.http.get<any[]>('http://localhost:5000/api/users');
  }

  /**  Fetch chat history between two users */
  getChatHistory(user1: string, user2: string): Observable<any[]> {
    return new Observable(observer => {
      this.http.get<any[]>(`${this.apiUrl}/messages/${user1}/${user2}`).subscribe(
        (messages) => {
          this.messageSubject.next(messages);
          observer.next(messages);
          observer.complete();
        },
        (error) => {
          observer.error(error);
        }
      );
    });
  }

  /**  Fetch all groups for a user */
  getGroups(username: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.socketUrl}/groups?username=${username}`);
  }

  /**  Fetch chat history for a group */
  getGroupChatHistory(groupName: string): Observable<any[]> {
    return new Observable(observer => {
      this.http.get<any[]>(`${this.apiUrl}/groups/messages/${encodeURIComponent(groupName)}`).subscribe(
        (messages) => {
          this.messageSubject.next(messages);
          observer.next(messages);
          observer.complete();
        },
        (error) => {
          observer.error(error);
        }
      );
    });
  }

  // Send private message
  sendPrivateMessage(receiver: string, message: string): void {
    const messageData = {
      sender: this.currentUser,
      receiver,
      message,
      timestamp: new Date()
    };
    
    // The message will be added when received from the socket
    this.socket.emit('send_private_message', messageData);
  }

  // Send group message
  sendGroupMessage(groupName: string, message: string): void {
    const messageData = {
      sender: this.currentUser,
      group: groupName,
      message,
      timestamp: new Date()
    };
    

    // The message will be added when received from the socket
    this.socket.emit('send_group_message', messageData);
  }

  putGroupMessage(data:any): Observable<any> {
    console.log("--------------------------------------------",data);
    return this.http.put<any>(`${this.socketUrl}/groups/userMessage`,data);
  }

  // Join a group
  joinGroup(groupName: string): void {
    this.socket.emit('join_group', { group: groupName, user: this.currentUser });
  }

  // Leave a group
  leaveGroup(groupName: string): void {
    this.socket.emit('leave_group', { group: groupName, user: this.currentUser });
  }

  // Get message updates
  getMessages(): Observable<any[]> {
    return this.messageSubject.asObservable();
  }

  // Get typing status updates
  getTypingStatus(): Observable<{user: string, isTyping: boolean}> {
    return this.typingSubject.asObservable();
  }

  // Get online users updates
  getOnlineUsers(): Observable<string[]> {
    return this.onlineUsersSubject.asObservable();
  }

  // Add method to get unread message count
  getUnreadMessageCount(username: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/messages/unread/${username}`);
  }

  getGroupUnreadCount(groupName: string, username: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/groups/unread/${groupName}/${username}`);
  }

  markGroupMessagesAsRead(groupName: string, username: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/groups/messages/read/${groupName}/${username}`, {});
  }

  // Add method to mark messages as read
  markMessagesAsRead(currentUser: string, sender: string): Observable<any> {
    return this.http.put<any>(`${this.socketUrl}/chat/messages/read/${sender}/${currentUser}`, {});
  }

  // Emit typing status for private chat
  emitTyping(receiver: string, isTyping: boolean): void {
    const data = { sender: this.currentUser, receiver };
    this.socket.emit(isTyping ? 'typing' : 'stop_typing', data);
  }

  // Emit typing status for group chat
  emitGroupTyping(groupName: string, isTyping: boolean): void {
    const data = { sender: this.currentUser, group: groupName };
    this.socket.emit(isTyping ? 'typing_group' : 'stop_typing_group', data);
  }

  addUserToGroup(data:any): Observable<any> {
    return this.http.post<any>(`${this.socketUrl}/groups/addUser`,data);
  }

  createGroup(data:any): Observable<any> {
    return this.http.post(`${this.socketUrl}/groups/create`,data);
  }

  // Cleanup on component destroy
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  // Update messages
  updateMessages(messages: any[]) {
    this.messageSubject.next(messages);
  }
}

