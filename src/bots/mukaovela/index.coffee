class Bot
  constructor: (@game, @playerNumber) ->
    @buildProfile = new BuildProfile(@game)

  doTurn: ->
    console.log "doTurn"
    self = this

    unitTiles = @game.getTiles(unitOwner: @playerNumber)
    unitTiles.sort((a, b) -> b.unit.unitType.price - a.unit.unitType.price)
    this.doUnit tile, tile.unit for tile in unitTiles

    buildTiles = @game.getTiles(canBuild: true, owner: @playerNumber, hasUnit: false)
    tileThreat = (tile) -> sum(self.evaluateThreats(tile), (t) -> t.threat)
    buildTilesWithThreats = ({tile: tile, threat: tileThreat(tile)} for tile in buildTiles)
    buildTilesWithThreats.sort((a, b) -> b.threat - a.threat)
    this.doBuild t.tile for t in buildTilesWithThreats

    @game.endTurn()

  doUnit: (tile, unit) ->
    console.log "doUnit"
    destinations = (@game.getTile(o.pos.x, o.pos.y) for o in @game.logic.unitMovementOptions(tile.x, tile.y))
    actions = (this.findBestUnitAction(unit, tile, destination) for destination in destinations)
    actionsWithoutMoves = (a for a in actions when a.action != "move")
    actions = actionsWithoutMoves if actionsWithoutMoves.length > 0
    action = pickMax(actions, (a) -> a.score)
    this.performUnitAction(unit, tile, action)

  doBuild: (tile) ->
    console.log "doBuild"
    threats = this.evaluateThreats(tile)
    buildOptions = @game.logic.tileBuildOptions(tile.x, tile.y)
    potentialUnits = (t.id for t in buildOptions when t.price <= @game.currentPlayer().funds)

    if potentialUnits.length > 0
      threatsExist = (t for t of threats).length > 0
      unitToBuild = potentialUnits[Math.floor(Math.random() * potentialUnits.length)] if not threatsExist
      if threatsExist
        threatToCounter = pickWeightedRandom(threats, (t) -> t)
        efficiencies = @buildProfile.getEfficiencies(threatToCounter)
        potentialUnitsWithEfficiencies = (e for e in efficiencies when e.unitTypeId in potentialUnits and e.efficiency > 0.5)
        unitToBuildIndex = pickWeightedRandom(potentialUnitsWithEfficiencies, (e) -> e.efficiency) if potentialUnitsWithEfficiencies.length > 0
        unitToBuild = potentialUnitsWithEfficiencies[unitToBuildIndex].unitTypeId if unitToBuildIndex?
      @game.build(tile.x, tile.y, unitToBuild) if unitToBuild?


  evaluateThreats: (targetTile) ->
    console.log "evaluateThreats"
    threats = {}
    game = @game
    for tile in @game.getTiles(notUnitOwner: @playerNumber)
      do (tile) ->
        threats[tile.unit.type] = 0 if not threats[tile.unit.type]?
        threats[tile.unit.type] += 1 / game.logic.getDistance(targetTile.x, targetTile.y, tile.x, tile.y)

    return threats

  findBestUnitAction: (unit, src, dst) ->
    console.log "findBestUnitAction"
    canCapture = @game.unitTypeHasFlag(unit.unitType, "Capture")
    ownTile = dst.owner == @playerNumber
    neutralTile = dst.owner == 0
    enemyTile = not ownTile and not neutralTile
    buildTile = @game.terrainCanBuild(dst.terrain)
    attacks = @game.logic.unitAttackOptions(src.x, src.y, dst.x, dst.y)

    bestAction = {score: -Infinity}

    if @game.logic.unitCanCapture(src.x, src.y, dst.x, dst.y)
      toCapture = @game.getTile(src.x, src.y)
      score = 200 - (toCapture.capturePoints - unit.health)
      score *= 100
      if score > bestAction.score
        bestAction = {
          score: score,
          dst: dst,
          action: "capture"
        }

    if attacks? and attacks.length > 0
      game = @game
      playerNumber = @playerNumber
      scoreAttack = (attack) ->
        targetTile = game.getTile(attack.pos.x, attack.pos.y)
        targetUnit = targetTile.unit
        score = attack.power * targetUnit.unitType.price
        score = score * 3 if targetUnit.capturing
        score = score * 2 if targetUnit.capturing and targetTile.owner == playerNumber
        if attack.power < targetUnit.health
          oldHealth = targetUnit.health
          targetUnit.health -= attack.power
          counterDamage = game.logic.calculateDamage(targetUnit, targetTile, unit, dst)
          targetUnit.health = oldHealth
          score = score - counterDamage * unit.unitType.price if counterDamage?
        return score

      attackScores = ({score: scoreAttack(attack), attack: attack} for attack in attacks)
      bestAttack = pickMax(attackScores, (a) -> a.score)

      if bestAttack.score > bestAction.score
        bestAction = {
          score: score,
          dst: dst,
          action: "attack",
          target: bestAttack.attack.pos
        }


    if @game.logic.unitCanDeploy(src.x, src.y, dst.x, dst.y)
      unit.deployed = true
      potentialAttacks = @game.logic.unitAttackOptions(src.x, src.y, dst.x, dst.y).length
      if potentialAttacks > 0
        score = potentialAttacks
        if buildTile and not neutralTile
          score += if ownTile then -2000 else 2000

        if score > bestAction.score
          bestAction = {
            score: score,
            dst: dst,
            action: "deploy"
          }

      unit.deployed = false

    if @game.logic.unitCanUndeploy(src.x, src.y)
      score = -attacks.length
      if score > bestAction.score
        bestAction = {
          score: score,
          action: "undeploy"
        }


    ###
    if(@game.logic.unitCanLoadInto(src.x, src.y, dst.x, dst.y)) {

    }

    if(@game.logic.unitCanUnload(src.x, src.y, dst.x, dst.y)) {

    }
    ###

    if bestAction.score < 0
      game = @game
      playerNumber = @playerNumber

      scoreTile = (tile) ->
        score = if tile.owner == playerNumber and (not tile.unit? or tile.unit.owner == playerNumber) then -10 else 10
        score *= if tile.unit? and tile.unit.owner == playerNumber and tile.beingCaptured then 0 else 1
        score = score * 2 if tile.owner == 0 and canCapture
        score = score * 2 if game.terrainCanBuild(tile.terrain)
        distance = game.logic.getDistance(tile.x, tile.y, dst.x, dst.y)
        distance = 1 if distance == 0
        return {tile: tile, distance: distance, score: score}

      importantTiles = (scoreTile(tile) for tile in @game.getTiles(capturable: true))
      totalDistance = sum(importantTiles, (t) -> t.distance)
      score = sum((t.score * totalDistance / t.distance) for t in importantTiles) / importantTiles.length
      score = 0.01 * score if score > 0 and not canCapture and neutralTile
      score = 0.01 * score if score > 0 and ownTile and buildTile

      if score > bestAction.score
        bestAction = {
          score: score,
          action: "move",
          dst: dst
        }


    return bestAction

  performUnitAction: (unit, tile, action) ->
    console.log "performUnitAction"
    switch action.action
      when "capture"  then @game.moveAndCapture(tile.x, tile.y, action.dst.x, action.dst.y)
      when "attack"   then @game.moveAndAttack(tile.x, tile.y, action.dst.x,action. dst.y, action.target.x, action.target.y)
      when "deploy"   then @game.moveAndDeploy(tile.x, tile.y, action.dst.x, action.dst.y)
      when "undeploy" then @game.undeploy(tile.x, tile.y)
      when "load"     then @game.moveAndLoadInto(tile.x, tile.y, action.dst.x, action.dst.y)
      when "unload"   then @game.moveAndUnload(tile.x, tile.y, action.dst.x, action.dst.y, action.target.x, action.target.y)
      when "move"     then @game.moveAndWait(tile.x, tile.y, action.dst.x, action.dst.y)

    unit.moved = true

exports.Bot = Bot

#----------------------------------------------------------------------------#

sum = (values, getFunction) ->
  total = 0
  for value in values
    do (value) ->
      if getFunction?
        total += getFunction(value)
      else
        total += value
  return total

pickMax = (values, weightingFunction) ->
  result = null
  maxWeight = -Infinity
  for value in values
    do (value) ->
      w = weightingFunction(value)
      if w > maxWeight
        maxWeight = w
        result = value

  return result

pickWeightedRandom = (values, weightingFunction) ->
  totalWeight = sum((v for k, v of values), weightingFunction)
  randomWeight = Math.random() * totalWeight
  randomKey = null

  for key, value of values
    do (key, value) ->
      randomKey = key if randomWeight > 0
      randomWeight -= weightingFunction(value)

  return randomKey


class BuildProfile
  constructor: (@game) ->
    unitTypes = @game.rules.units
    weapons = @game.rules.weapons

    getPower = (weaponId, armorId) ->
      weapon = weapons[weaponId]
      power = weapon?.powerMap[armorId]
      power = 0 if not power?
      return power

    getMaxPower = (attackerType, targetType) ->
      primaryPower = getPower(attackerType.primaryWeapon, targetType.armor)
      secondaryPower = getPower(attackerType.secondaryWeapon, targetType.armor)
      return if primaryPower > secondaryPower then primaryPower else secondaryPower

    getEfficiency = (attackerTypeId, targetTypeId) ->
      attackerType = unitTypes[attackerTypeId]
      targetType = unitTypes[targetTypeId]

      attackerPower = getMaxPower(attackerType, targetType)
      targetPower = getMaxPower(targetType, attackerType)
      targetPower = 1 if targetPower == 0

      return (attackerPower * targetType.price) / (targetPower * attackerType.price)

    getEfficienciesAgainst = (targetTypeId) ->
      ({unitTypeId: parseInt(attackerTypeId), efficiency: getEfficiency(attackerTypeId, targetTypeId)} for attackerTypeId of unitTypes)

    @efficiencies = ({unitTypeId: unitTypeId, efficiencies: getEfficienciesAgainst(unitTypeId)} for unitTypeId of unitTypes)

    #console.log ";" + (unitTypes[e.unitTypeId].name for e in @efficiencies).join(";")
    #for e in @efficiencies
    #  do (e) ->
    #    console.log unitTypes[e.unitTypeId].name + ";" + (eff.efficiency for eff in e.efficiencies).join(";")
    #

  getEfficiencies: (unitTypeId) -> (e.efficiencies for e in @efficiencies when e.unitTypeId is unitTypeId)[0]
