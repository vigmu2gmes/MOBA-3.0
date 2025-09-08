-- Put functions in this file to use them in several other scripts.
-- To get access to the functions, you need to put:
-- require "my_directory.my_file"
-- in any script using the functions.

local game = {}

game.c = require("colyseus.sdk")
game.client = game.c.Client("ws://localhost:2567")

function game.create(self)
	game.client:join_or_create("match", {}, function(err, room)
		if err then
			pprint(err)
			return
		end
		game.room = room
		game.cb = game.c.callbacks(game.room)

		game.cb:on_add("players", function(player, sessionId)
			if player.id % 2 == 0 then
				self.bf = factory.create("#red_team", vmath.vector3(player.x, player.y, 0), nil, { name = hash(sessionId) }, 1)
			else
				self.bf = factory.create("#blue_team", vmath.vector3(player.x, player.y, 0), nil, { name = hash(sessionId) }, 1)
			end
			
			game.players = game.player or {}
			game.players[sessionId] = self.bf
			
			game.cb:listen(player, "x", function(n, p)
				local pos = go.get_position(self.bf)
				pos.x = n
				go.set_position(pos, self.bf)
			end)

			game.cb:listen(player, "y", function(n, p)
				local pos = go.get_position(self.bf)
				pos.y = n
				go.set_position(pos, self.bf)
			end)	

			game.cb:listen(player, "hp", function(n) 
				--print(n)
			end)	
		end)

		game.cb:on_add("bases", function(base, key)
			game.bases = game.bases or {}
			
			game.bases[key] = factory.create("#" .. key .. "_base", vmath.vector3(base.x, base.y, 0), nil, { team = hash(base.team) }, 0.45)
		end)

		game.cb:on_add("towers", function(towers, key) 
			game.towers = game.towers or {}
			
			game.towers[key] = factory.create("#" .. key, vmath.vector3(towers.x, towers.y, 0), nil, { team = hash(towers.team) }, 1)
		end)

		
	end)
end



return game