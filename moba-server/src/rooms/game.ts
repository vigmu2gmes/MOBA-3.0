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

class Enemy extends Schema {
	@type("string") team: string;
	@type("number") hp: number = 10;
	@type("number") x: number;
	@type("number") y: number;
	@type("number") vx: number;
	@type("number") vy: number;
}

class Projectile extends Schema {
	@type("number") x: number;
	@type("number") y: number;
	@type("number") vx: number;
	@type("number") vy: number;
	@type("string") target_id: string;
	@type("string") source_id: string;
}


class game_state extends Schema {
	@type({ map: Player }) players = new MapSchema<Player>();
	@type({ map: Base }) red_base = new MapSchema<Base>();
	@type({ map: Base }) blue_base = new MapSchema<Base>();
	@type({ map: Tower }) towers = new MapSchema<Tower>();
	@type({ map: Enemy }) minions = new MapSchema<Enemy>();
	@type({ map: Projectile }) projectile = new MapSchema<Projectile>();
	@type("number") player_count = 0; 
}

const spawn_positions = [ 
	{ x: 0, y: 0 },
	{ x: 220, y: 281 },
	{ x: 725, y: 281 },
	{ x: 100, y: 400 },
	{ x: 850, y: 400 },
	{ x: 100, y: 150 },
	{ x: 850, y: 150 }, 
];

export class my_game extends Room<game_state> {
	maxClients = 6;
	state = new game_state();

	spawn_minion(team: "red" | "blue") {
	const base = team === "red" ? this.state.red_base.get("red") : this.state.blue_base.get("blue");

	if (!base) return;
	const id = `${team}_minion_${Date.now()}`;
	const minion = new Enemy().assign({ team, x: base.x, y: base.y, vx: team === "red" ? -5 : 5, vy: 0, hp: 10 	});
	this.state.minions.set(id, minion);
	}

	onCreate (options: any) {
	this.state.player_count = this.clients.length;

	this.state.red_base.set("red", new Base().assign({ team: "red", x: 860, y: 281  }));
	this.state.blue_base.set("blue", new Base().assign({ team: "blue", x: 94, y: 281  }));
	this.state.towers.set("neutral", new Tower().assign({ team: "neutral", x: 500, y: 516  }));
	
	this.clock.setInterval(() => this.spawn_minion("red"), 5000);
	this.clock.setInterval(() => this.spawn_minion("blue"), 5000);
	this.setSimulationInterval(() => this.update(), 1000 / 20); // 20 FPS

	this.state.projectile.set("projectile", new Projectile().assign({ x: 500, y: 516 }), 500);
	
	
	this.onMessage("projectile_destroyed", (client, message) => {
		const target = this.state.players.get(message.t);
		target.hp = Math.max(0, target.hp - message.damage);

		if (message.p == "hash: [projectile]") {
			let source = "projectile";
			this.state.projectile.delete(source);

			this.clock.setTimeout(() => {
				this.state.projectile.set("projectile", new Projectile().assign({ x: 500, y: 516 }));
			}, 500);
		}		
	});

	


	this.onMessage("move", (client, message) => {
	const player = this.state.players.get(client.sessionId);
	if (!player) return;

	const speed = 5;
	let new_x = player.x;
	let new_y = player.y;

	switch (message.direction) {
		case "up":    new_y += speed; break;
		case "down":  new_y -= speed; break;
		case "left":  new_x -= speed; break;
		case "right": new_x += speed; break;
	}

	const red_base  = this.state.red_base.get("red");
	const blue_base = this.state.blue_base.get("blue");
	const tower = this.state.towers.get("neutral");
	const base_radius = 120; 

	const red_dx = new_x - red_base.x;
	const red_dy = new_y - red_base.y;
	const blue_dx = new_x - blue_base.x;
	const blue_dy = new_y - blue_base.y;
	const tower_dx = new_x - tower.x;
	const tower_dy = new_y - tower.y;

	const red_distance  = Math.sqrt(red_dx * red_dx + red_dy * red_dy);
	const blue_distance = Math.sqrt(blue_dx * blue_dx + blue_dy * blue_dy);
	const tower_distance = Math.sqrt(tower_dx * tower_dx + tower_dy * tower_dy);

	if (red_distance > base_radius && blue_distance > base_radius && tower_distance > base_radius) {
		player.x = new_x;
		player.y = new_y;
	}
});


	this.onMessage("attack", (client, message) => {
		let target;
		if ( message.type === "hash: [tower_hitbox]" ) {
			target = this.state.towers.get(message.id);
		} 
		else if ( message.type === "hash: [red_base_hitbox]" ) {
			target = this.state.red_base.get(message.id);
		} 
		else if ( message.type === "hash: [blue_base_hitbox]" ) {
			target = this.state.blue_base.get(message.id);
		}
		else if ( message.type === "hash: [minion]" ) {
			target = this.state.minions.get(message.id);
		}

		if (target) {
			target.hp = Math.max(0, target.hp - message.damage);
			//console.log(`${message.type} received ${message.damage}. HP = ${target.hp}.`);
		}
	});

	
	this.onMessage("building_destroyed", (client, message) => {
		if (message.b == "red") {
			this.state.red_base.delete("red");
		}
		else if (message.b == "blue") {
			this.state.blue_base.delete("blue");
		}
		else if (message.b == "neutral") {
			this.state.towers.delete(message.b);
		}
	});
	
	this.onMessage("minion_death", (client, message) => {
		const minion = this.state.minions.get(message.b);
		if (minion) {
			this.state.minions.delete(message.b);
		}
	});

	this.onMessage("tower_trigger", (client, message) => {
		console.log(message.tower_id);
	});
}


	update() {
	for (const [id, minion] of this.state.minions.entries()) {
		minion.x += minion.vx;
		minion.y += minion.vy;
	}
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