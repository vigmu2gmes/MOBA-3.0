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

		-- PLAYERS --
		game.cb:on_add("players", function(player, sessionId) 
			local team = player.id % 2 == 0 and "red" or "blue"
			local pos = vmath.vector3(player.x, player.y, 0)
			game.initial_player_health = player.hp
			local factory_id = team == "red" and "#red_team" or "#blue_team"
			self.player_go = factory.create(factory_id, pos, nil, { name = hash(sessionId) }, 1)

			game.players = game.players or {}
			game.players[sessionId] = self.player_go
			
			game.go_to_session = game.go_to_session or {}
			game.go_to_session[self.player_go] = sessionId

			game.cb:listen(player, "x", function(x)
				game.pos = go.get_position(self.player_go)
				game.pos.x = x
				go.set_position(game.pos, self.player_go)
			end)

			game.cb:listen(player, "y", function(y)
				game.pos = go.get_position(self.player_go)
				game.pos.y = y
				go.set_position(game.pos, self.player_go)
			end)

			

			game.cb:listen(player, "hp", function(hp)
				game.current_player_health = hp
				print(game.current_player_health)
				if game.current_player_health <= 0 then
					print("DEATH")
				end
			end)
		end)

		-- PLAYERS --

		-- RED BASE --
		game.cb:on_add("red_base", function(base, key)
			game.base_red_health = base.hp
			self.red_base = factory.create("#red_base", vmath.vector3(base.x, base.y, 0), nil, { team = hash(base.team) }, 0.45)

			game.cb:listen(base, "hp", function(n)
				game.red_base_damage_report = n
				if n <= 0 then
					game.room:send("building_destroyed", { b = "red" })
				end
			end)
		end)

		game.cb:on_remove("red_base", function()
			go.delete(self.red_base)
		end)
		-- RED BASE --

		-- BLUE BASE --
		game.cb:on_add("blue_base", function(base, key)
			game.base_blue_health = base.hp
			self.blue_base = factory.create("#blue_base", vmath.vector3(base.x, base.y, 0), nil, { team = hash(base.team) }, 0.45)

			game.cb:listen(base, "hp", function(n)
				game.blue_base_damage_report = n
				if n <= 0 then
					game.room:send("building_destroyed", { b = "blue" })
				end
			end)
		end)

		game.cb:on_remove("blue_base", function()
			go.delete(self.blue_base)
		end)
		-- BLUE BASE --

		-- TOWERS --
		game.cb:on_add("towers", function(tower, key)
			game.base_tower_health = tower.hp
			game.towers = game.towers or {}
			local pos = vmath.vector3(tower.x, tower.y, 0)
			local go_id = factory.create("#neutral", pos, nil, { team = hash(tower.team) }, 1)

			game.towers[key] = go_id  -- ✅ store GO by Colyseus key

			game.cb:listen(tower, "hp", function(n)
				game.tower_damage_report = n
				if n <= 0 then
					game.room:send("building_destroyed", { b = tower.team })
				end
			end)
		end)

		game.cb:on_remove("towers", function(_, key)
			if game.towers and game.towers[key] then
				go.delete(game.towers[key])
				game.towers[key] = nil
			end
		end)
		-- TOWERS --

		-- PROJECTILE --
		game.cb:on_add("projectile", function(projectile, key) 
			factory.create("#projectiles", vmath.vector3(projectile.x, projectile.y, 0), nil, { id = hash(key) })
		end)
		
		-- PROJECTILE -- 

		-- MINIONS --
		game.cb:on_add("minions", function(minion, index)
			game.minion_index = index

			local pos = vmath.vector3(minion.x, minion.y, 0)
			local factory_id = minion.team == "red" and "#red_minion_factory" or "blue" and "#blue_minion_factory"
			local go_id = factory.create(factory_id, pos, nil, { team = hash(minion.team), id = hash(index) }, 1)
			

			game.minions = game.minions or {}
			game.minions[index] = go_id

			game.id_lookup = game.id_lookup or {}
			game.id_lookup[hash(index)] = index
			

			game.cb:listen(minion, "x", function(new_x)
				local go_id = game.minions[index]
				if go_id then
					local pos = go.get_position(go_id)
					pos.x = new_x
					go.set_position(pos, go_id)
				end
			end)

			game.cb:listen(minion, "y", function(new_y)
				local go_id = game.minions[index]
				if go_id then
					local pos = go.get_position(go_id)
					pos.y = new_y
					go.set_position(pos, go_id)
				end
			end)

			game.cb:listen(minion, "hp", function(n)
				if n <= 0 then
					game.room:send("minion_death", { b = index })
				end
			end)
		end)

		game.cb:on_remove("minions", function(minion, index)
			-- Look up the GO ID we stored when this minion was spawned
			local go_id = game.minions and game.minions[index]
			if go_id then
				-- Delete the game object from the scene
				go.delete(go_id)
				-- Remove it from our lookup table
				game.minions[index] = nil
			end

			-- Optional: clean up any reverse lookup tables or extra data
			if game.id_lookup then
				game.id_lookup[index] = nil
			end

			print("Removed minion:", index)
		end)
		
		-- MINIONS -- 
	end)
end

return game