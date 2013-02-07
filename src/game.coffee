GameLogic = require("./GameLogic").GameLogic
bz = require("bzutils")

class Game
  constructor: (@client, @gameId, @rules) ->
    @data = null
    @logic = new GameLogic(this, @rules)

exports.Game = Game

Game::update = (cb) ->
  @client.stub.gameData @gameId, (result) =>
    setUnitType = (unit) =>
      unit.unitType = @rules.units[unit.type]
      if unit.carriedUnits?
        setUnitType u for u in unit.carriedUnits

    @data = result.game
    for tile in @data.tiles
      tile.terrain = @rules.terrains[tile.type]
      setUnitType tile.unit  if tile.unit?

    cb(@data) if cb?

Game::currentPlayer = -> @getPlayer @data.inTurnNumber

Game::getPlayer = (playerNumber) ->
  for player in @data.players
    return player if player.playerNumber is playerNumber

Game::getTile = (x, y) ->
  if x? and y?
    return bz.find @data.tiles, (t) -> t.x is x and t.y is y
  else if x?
    return bz.find @data.tiles, (t) -> t.tileId is x
  else
    null

Game::getMapArray = ->
  mapArray = {}
  for tile in @data.tiles
    mapArray[tile.y] = {}  unless tile.y of mapArray
    mapArray[tile.y][tile.x] = tile
  return mapArray

Game::getTiles = (conditions) ->
  conditions = {} unless conditions?
  result = []

  for tile in @data.tiles
    terrain = @rules.terrains[tile.type]
    continue  if conditions.canBuild? and (terrain.buildTypes.length isnt 0) isnt conditions.canBuild
    continue  if conditions.owner? and tile.owner isnt conditions.owner
    continue  if conditions.notOwner? and tile.owner is conditions.notOwner
    continue  if conditions.capturable? and @terrainHasFlag(terrain, "Capturable") isnt conditions.capturable
    continue  if conditions.hasUnit? and (tile.unit isnt null) isnt conditions.hasUnit
    continue  if conditions.unitOwner? and (tile.unit is null or tile.unit.owner isnt conditions.unitOwner)
    continue  if conditions.notUnitOwner? and (tile.unit is null or tile.unit.owner is conditions.notUnitOwner)
    continue  if conditions.notUnitOwnerOrNoUnit? and (tile.unit isnt null and tile.unit.owner is conditions.notUnitOwner)
    result.push tile

  return result

Game::unitTypeHasFlag = (unitType, flagName) ->
  for flagId in unitType.flags
    flag = @rules.unitFlags[flagId]
    return true  if flag.name is flagName
  return false

Game::terrainHasFlag = (terrain, flagName) ->
  for flagId in terrain.flags
    flag = @rules.terrainFlags[flagId]
    return true  if flag.name is flagName
  return false

Game::terrainCanBuild = (terrain) -> terrain.buildTypes.length > 0

Game::moveAndAttack = (x, y, dx, dy, tx, ty) ->
  path = @logic.unitCanMoveTo(x, y, dx, dy)
  return false  unless path?

  attackOpts = @logic.unitAttackOptions(x, y, dx, dy)
  return false  unless attackOpts?

  attack = attackOpts.filter((o) -> o.pos.x is tx and o.pos.y is ty)[0]
  return false  unless attack?

  src = @getTile(x, y)
  dst = @getTile(dx, dy)
  target = @getTile(tx, ty)

  if x isnt dx or y isnt dy
    dst.unit = src.unit
    src.unit = null

  @client.stub.moveAndAttack @gameId, dst.unit.unitId, {x: dx, y: dy}, path, target.unit.unitId
  target.unit.health -= attack.power
  target.unit = null  if target.unit.health <= 0
  return true

Game::moveAndWait = (x, y, dx, dy) ->
  path = @logic.unitCanMoveTo(x, y, dx, dy)
  return false  unless path?

  src = @getTile(x, y)
  dst = @getTile(dx, dy)
  if x isnt dx or y isnt dy
    dst.unit = src.unit
    src.unit = null
  @client.stub.moveAndWait @gameId, dst.unit.unitId, {x: dx, y: dy}, path
  return true

Game::moveAndCapture = (x, y, dx, dy) ->
  path = @logic.unitCanMoveTo(x, y, dx, dy)
  return false  if not path? or not @logic.unitCanCapture(x, y, dx, dy)

  src = @getTile(x, y)
  dst = @getTile(dx, dy)

  if x isnt dx or y isnt dy
    dst.unit = src.unit
    src.unit = null

  dst.unit.capturing = true
  dst.capturePoints -= dst.unit.health

  if dst.capturePoints <= 0
    previousOwner = dst.owner
    dst.owner = dst.unit.owner
    dst.capturePoints = 1
    dst.beingCaptured = false
    if @terrainHasFlag(@rules.terrains[dst.type], "HQ") and previousOwner isnt 0
      lastHQ = true

      for tile in @data.tiles
        if tile.owner is previousOwner and @terrainHasFlag(@rules.terrains[tile.type], "HQ")
          lastHQ = false
          break

      if lastHQ
        for tile in @data.tiles
          tile.unit.owner = 0  if tile.unit isnt null and tile.unit.owner is previousOwner
          tile.owner = 0  if tile.owner is previousOwner
  else
    dst.beingCaptured = true

  @client.stub.moveAndCapture @gameId, dst.unit.unitId, {x: dx, y: dy}, path
  return true

Game::moveAndDeploy = (x, y, dx, dy) ->
  path = @logic.unitCanMoveTo(x, y, dx, dy)
  return false  if not path? or not @logic.unitCanDeploy(x, y, dx, dy)
  src = @getTile(x, y)
  dst = @getTile(dx, dy)

  if x isnt dx or y isnt dy
    dst.unit = src.unit
    src.unit = null

  dst.unit.deployed = true
  @client.stub.moveAndDeploy @gameId, dst.unit.unitId, {x: dx, y: dy}, path
  return true

Game::undeploy = (x, y) ->
  return false  unless @logic.unitCanUndeploy(x, y)
  dst = @getTile(x, y)
  dst.unit.deployed = false
  @client.stub.undeploy @gameId, dst.unit.unitId
  return true

Game::moveAndLoadInto = (x, y, dx, dy) ->
  path = @logic.unitCanMoveTo(x, y, dx, dy)
  return false  if not path? or not @logic.unitCanLoadInto(x, y, dx, dy)
  src = @getTile(x, y)
  dst = @getTile(dx, dy)
  unit = src.unit
  dst.unit.carriedUnits.push src.unit
  src.unit = null
  @client.stub.moveAndLoadInto @gameId, unit.unitId, dst.unit.unitId, path
  return true

Game::moveAndUnload = (x, y, dx, dy, tx, ty, unitId) ->
  path = @logic.unitCanMoveTo(x, y, dx, dy)
  return false  unless path?

  unloadOpts = @logic.unitUnloadOptions(x, y, dx, dy)
  return false  if not unloadOpts? or unloadOpts.length is 0

  canUnloadUnit = unloadOpts.filter((o) -> o.unitId is unitId).length > 0
  return false  unless canUnloadUnit

  unloadTargetOpts = @logic.unitUnloadTargetOptions(x, y, dx, dy, unitId)
  return false  if not unloadTargetOpts? or unloadTargetOpts.length is 0

  canUnloadToTarget = unloadTargetOpts.filter((o) -> o.x is tx and o.y is ty).length > 0
  return false  unless canUnloadToTarget

  src = @getTile(x, y)
  dst = @getTile(dx, dy)
  target = @getTile(tx, ty)

  if x isnt dx or y isnt dy
    dst.unit = src.unit
    src.unit = null

  target.unit = dst.unit.carriedUnits.filter((u) -> u.unitId is unitId)[0]

  @client.stub.moveAndUnload @gameId, dst.unit.unitId, {x: dx, y: dy}, path, unitId, {x: tx, y: ty}
  return true

Game::build = (x, y, unitTypeId) ->
  return false  unless @logic.tileCanBuild(@data.inTurnNumber, x, y)

  opts = @logic.tileBuildOptions(x, y)
  return false  if not opts or opts.length is 0

  canBuildUnit = opts.filter((o) -> o.id is unitTypeId).length > 0
  unitType = @rules.units[unitTypeId]
  player = @currentPlayer()
  return false  if not canBuildUnit or player.funds < unitType.price

  tile = @getTile(x, y)
  tile.unit =
    unitId: null
    tileId: tile.tileId
    type: unitTypeId
    owner: player.playerNumber
    carriedBy: null
    health: 100
    deployed: false
    moved: true
    capturing: false
    carriedUnits: []

  player.funds -= unitType.price
  @client.stub.build @gameId, unitTypeId, {x: x, y: y}

Game::endTurn = -> @client.stub.endTurn @gameId

Game::surrender = ->
