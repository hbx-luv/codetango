import {Component} from '@angular/core';

@Component({
  selector: 'app-chat-box',
  templateUrl: './chat-box.component.html',
  styleUrls: ['./chat-box.component.scss'],
})
export class ChatBoxComponent {
  chatShown = false;
  newMessage: string;
  messages = [];

  constructor() {}

  toggleChat() {
    this.chatShown = !this.chatShown;
  }

  sendMessage() {
    console.log('send message', this.newMessage);
    this.messages.push(this.newMessage);
    delete this.newMessage;
  }
}
