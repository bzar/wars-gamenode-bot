class Bot
  constructor: (@game, @playerNumber) ->
    @buildProfile = new BuildProfile(@game)

  doTurn: ->
    this.doUnit tile, tile.unit for tile in @game.getTiles(unitOwner: @playerNumber)
    buildTiles = @game.getTiles(canBuild: true, owner: @playerNumber, hasUnit: false)
    buildTilesWithThreats = ({tile: tile, threat: calculateTotalThreat(evaluateThreats(tile, @playerNumber, @game))} for tile in buildTiles)
    buildTilesWithThreats.sort((a, b) -> b.threat - a.threat)
    this.doBuild t.tile for t in buildTilesWithThreats

    @game.endTurn()

  doUnit: (tile, unit) -> #console.log "unit"

  doBuild: (tile) ->
    console.log "doBuild"
    threats = evaluateThreats(tile, @playerNumber, @game)
    console.log threats
    threatToCounter = pickWeightedRandom(threats, (threat) -> threat)
    console.log threatToCounter
    efficiencies = @buildProfile.getEfficiencies(threatToCounter)
    console.log efficiencies
    buildOptions = @game.logic.tileBuildOptions(tile.x, tile.y)
    potentialUnits = (t.id for t in buildOptions when t.price <= @game.currentPlayer().funds)
    console.log potentialUnits
    potentialUnitsWithEfficiencies = (e for e in efficiencies when e.unitTypeId in potentialUnits)
    console.log potentialUnitsWithEfficiencies
    unitToBuildIndex = pickWeightedRandom(potentialUnitsWithEfficiencies, (e) -> e.efficiency) if potentialUnits.length > 0
    console.log unitToBuildIndex
    unitToBuild = efficiencies[unitToBuildIndex].unitTypeId if unitToBuildIndex?
    console.log unitToBuild
    @game.build(tile.x, tile.y, unitToBuild) if unitToBuild?


exports.Bot = Bot

#----------------------------------------------------------------------------#


pickWeightedRandom = (values, weightingFunction) ->
  totalWeight = 0

  for key, value of values
    do (value) -> totalWeight += weightingFunction(value)

  randomWeight = Math.random() * totalWeight
  randomKey = null

  for key, value of values
    do (key, value) ->
      randomKey = key if randomWeight > 0
      randomWeight -= weightingFunction(value)

  return randomKey

getUnitTiles = (game, playerNumber) ->
  ({tile: tile, unit: tile.unit} for tile in game.data.tiles when tile.unit? and
    not tile.unit.moved and tile.unit.owner == playerNumber)

getEnemyTiles = (game, playerNumber) ->
  ({tile: tile, enemy: tile.unit} for tile in game.data.tiles when tile.unit? and
    tile.unit.owner != playerNumber)

getBuildTiles = (game, playerNumber) ->
  (tile for tile in game.data.tiles when not tile.unit? and
    tile.owner == playerNumber and
    game.rules.terrains[tile.type].buildTypes.length > 0)

evaluateThreats = (targetTile, playerNumber, game) ->
  enemies = getEnemyTiles(game, playerNumber)
  threats = {}
  for {tile, enemy} in enemies
    do (tile, enemy) ->
      threats[enemy.type] = 0 if not threats[enemy.type]?
      threats[enemy.type] += 1 / game.logic.getDistance(targetTile.x, targetTile.y, tile.x, tile.y);

  return threats;

calculateTotalThreat = (threats) ->
  total = 0

  for unitType, threat of threats
    do (threat) -> total += threat

  return total

class BuildProfile
  constructor: (@game) ->
    unitTypes = @game.rules.units
    weapons = @game.rules.weapons

    getPower = (weaponId, armorId) ->
      power = weapons[weaponId]?.powerMap[armorId]
      power = 1 if not power? or power == 0
      return power

    getMaxPower = (attackerType, targetType) ->
      primaryPower = getPower(attackerType.primaryWeapon, targetType.armor)
      secondaryPower = getPower(attackerType.secondaryWeapon, targetType.armor)
      return if primaryPower > secondaryPower then primaryPower else secondaryPower
      maxPower

    getEfficiency = (attackerTypeId, targetTypeId) ->
      attackerType = unitTypes[attackerTypeId]
      targetType = unitTypes[targetTypeId]

      attackerPower = getMaxPower(attackerType, targetType)
      targetPower = getMaxPower(targetType, attackerType)

      return (attackerPower * targetType.price) / (targetPower * attackerType.price)

    getEfficienciesAgainst = (targetTypeId) ->
      ({unitTypeId: parseInt(attackerTypeId), efficiency: getEfficiency(attackerTypeId, targetTypeId)} for attackerTypeId of unitTypes)

    @efficiencies = ({unitTypeId: unitTypeId, efficiencies: getEfficienciesAgainst(unitTypeId)} for unitTypeId of unitTypes)

  getEfficiencies: (unitTypeId) -> (e.efficiencies for e in @efficiencies when e.unitTypeId is unitTypeId)[0]
