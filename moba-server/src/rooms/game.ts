import { Room, Client } from "@colyseus/core";
import { Schema, MapSchema, type, ArraySchema } from "@colyseus/schema";

class Player extends Schema {
	@type("string") name: string;
	@type("number") x: number = 0;
	@type("number") y: number = 0;
	@type("number") hp: number = 25;
	@type("number") id: number = 0;
}

class Base extends Schema {
	@type("string") team: string;
	@type("number") x: number;
	@type("number") y: number;
	@type("number") hp: number = 100;
}

class Tower extends Schema {
	@type("string") team: string;
	@type("number") x: number;
	@type("number") y: number;
	@type("number") hp: number = 40;
}


class game_state extends Schema {
	@type({ map: Player }) players = new MapSchema<Player>();
	@type({ map: Base }) bases = new MapSchema<Base>();
	@type({ map: Tower }) towers = new MapSchema<Tower>();
	@type("number") player_count = 0; 
}

const spawn_positions = [ 
	{ x: 0, y: 0 },
	{ x: 200, y: 281 },
	{ x: 755, y: 281 },
	{ x: 100, y: 400 },
	{ x: 850, y: 400 },
	{ x: 100, y: 150 },
	{ x: 850, y: 150 }, 
];

export class my_game extends Room<game_state> {
	maxClients = 6;
	state = new game_state();

	onCreate (options: any) {
	this.state.player_count = this.clients.length;

	this.state.bases.set("red", new Base().assign({ team: "red", x: 860, y: 281  }));
	this.state.bases.set("blue", new Base().assign({ team: "blue", x: 94, y: 281  }));

	for (let i = 0; i < 2; i++) {
		this.state.towers.set("neutral", new Tower().assign({ team: "neutral", x: 563, y: 877 - i * 361  }));
	}

	this.onMessage("move", (client, message) => {
	const speed = 5;

	switch (message.direction) {
		case "up": this.state.players.get(client.sessionId).y += speed; break;
		case "down": this.state.players.get(client.sessionId).y -= speed; break;
		case "left": this.state.players.get(client.sessionId).x -= speed; break;
		case "right": this.state.players.get(client.sessionId).x += speed; break;
		}
	});

	this.onMessage("attack", (client, message) => {
	const attacker = this.state.players[client.sessionId];
	const target_id = message.target_id;
	const target = this.state.players[target_id];
	console.log(target_id);
	console.log(target);

	if (attacker && target) {
		target.hp = Math.max(0, target.hp - 20);
		console.log(`${attacker.id} attacked ${target.id}, HP: ${target.hp}`);
		}
	});
	}

	onJoin (client: Client, options: any) {
	this.state.player_count = this.clients.length;

	console.log(client.sessionId, "joined!");
	this.state.players.set(client.sessionId, new Player().assign({ name: client.sessionId, id: this.state.player_count, x: spawn_positions[this.state.player_count].x, y: spawn_positions[this.state.player_count].y }));
	}

	onLeave (client: Client, consented: boolean) {
	console.log(client.sessionId, "left!");
	this.state.players.delete(client.sessionId);
	}

	onDispose() {
	console.log("room", this.roomId, "disposing...");
	}
}