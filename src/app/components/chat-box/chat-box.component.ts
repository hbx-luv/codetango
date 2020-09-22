import {Component, Input} from '@angular/core';
import {Observable} from 'rxjs';
import {AuthService} from 'src/app/services/auth.service';
import {MessageService} from 'src/app/services/message.service';
import {Game, Message, TeamTypes} from 'types';

@Component({
  selector: 'app-chat-box',
  templateUrl: './chat-box.component.html',
  styleUrls: ['./chat-box.component.scss'],
})
export class ChatBoxComponent {
  @Input() game: Game;

  chatShown = false;
  newMessage: string;
  messages$: Observable<Message[]>;

  constructor(
      public readonly authService: AuthService,
      private readonly messageService: MessageService,
  ) {}

  ngOnInit() {
    this.messages$ = this.messageService.getSpymasterMessages(this.game.id);
  }

  get placeholder(): string {
    return this.game && this.game.completedAt ?
        'Click here to see the spymaster chat' :
        'Click here to chat with the other spymaster';
  }

  toggleChat() {
    this.chatShown = !this.chatShown;
  }

  sendMessage() {
    const {currentUserId: userId} = this.authService;
    const team = this.game.blueTeam.spymaster === userId ? TeamTypes.BLUE :
                                                           TeamTypes.RED;

    this.messageService.sendSpymasterMessage(this.game.id, {
      text: this.newMessage,
      timestamp: Date.now(),
      userId,
      team,
    });
    delete this.newMessage;
  }
}
