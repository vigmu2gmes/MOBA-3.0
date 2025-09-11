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
			local team = player.id % 2 == 0 and "red" or "blue"
			local pos = vmath.vector3(player.x, player.y, 0)
			local factory_id = team == "red" and "#red_team" or "#blue_team"
			local player_go = factory.create(factory_id, pos, nil, { name = hash(sessionId) }, 1)

			game.players = game.players or {}
			game.players[sessionId] = player_go

			player_gui.create_health_bar(sessionId, team, player.x, player.y)

			game.cb:listen(player, "x", function(new_x)
				local player_go = game.players[sessionId]
				if player_go then
					local pos = go.get_position(player_go)
					pos.x = new_x
					go.set_position(pos, player_go)
					player_gui.update_health_bar_position(sessionId, new_x, pos.y)
				end
			end)

			game.cb:listen(player, "y", function(new_y)
				local player_go = game.players[sessionId]
				if player_go then
					local pos = go.get_position(player_go)
					pos.y = new_y
					go.set_position(pos, player_go)
					player_gui.update_health_bar_position(sessionId, pos.x, new_y)
				end
			end)

			game.cb:listen(player, "hp", function(hp)
				player_gui.update_health_bar_value(sessionId, hp)
			end)
		end)

		game.cb:on_remove("players", function(player, sessionId)
			local player_go = game.players[sessionId]
			if player_go then
				go.delete(player_go)
				game.players[sessionId] = nil
			end
			player_gui.remove_health_bar(sessionId)
		end)
	end)
end

return game
