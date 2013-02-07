class Bot
  constructor: (@game, @playerNumber) ->
    @buildProfile = new BuildProfile(@game)

  doTurn: ->
    unitTiles = @game.getTiles(unitOwner: @playerNumber)
    unitTiles.sort((a, b) -> b.unit.unitType.price - a.unit.unitType.price)
    @doUnit tile, tile.unit for tile in unitTiles

    buildTiles = @game.getTiles(canBuild: true, owner: @playerNumber, hasUnit: false)
    tileThreat = (tile) => sum((v for k, v of @evaluateThreats(tile)), (t) -> t)
    buildTilesWithThreats = ({tile: tile, threat: tileThreat(tile)} for tile in buildTiles)
    buildTilesWithThreats.sort((a, b) -> b.threat - a.threat)
    @doBuild t.tile for t in buildTilesWithThreats

    @game.endTurn()

  doUnit: (tile, unit) ->
    destinations = (@game.getTile(o.pos.x, o.pos.y) for o in @game.logic.unitMovementOptions(tile.x, tile.y))
    actions = (@findBestUnitAction(unit, tile, destination) for destination in destinations)
    actionsWithoutMoves = (a for a in actions when a.action != "move")
    actions = actionsWithoutMoves if actionsWithoutMoves.length > 0
    action = pickMax(actions, (a) -> a.score)
    @performUnitAction(unit, tile, action)

  doBuild: (tile) ->
    threats = @evaluateThreats(tile)
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
    threats = {}
    for tile in @game.getTiles(notUnitOwner: @playerNumber)
      do (tile) =>
        threats[tile.unit.type] = 0 if not threats[tile.unit.type]?
        threats[tile.unit.type] += 1 / @game.logic.getDistance(targetTile.x, targetTile.y, tile.x, tile.y)

    return threats

  findBestUnitAction: (unit, src, dst) ->
    canCapture = @game.unitTypeHasFlag(unit.unitType, "Capture")
    capturable = @game.terrainHasFlag(dst.terrain, "Capturable")
    ownTile = @game.logic.areAllies(dst.owner, @playerNumber)
    neutralTile = dst.owner == 0
    enemyTile = not ownTile and not neutralTile
    buildTile = @game.terrainCanBuild(dst.terrain)
    attacks = @game.logic.unitAttackOptions(src.x, src.y, dst.x, dst.y)

    bestAction = {action: "nothing", score: -Infinity}

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
      scoreAttack = (attack) =>
        targetTile = @game.getTile(attack.pos.x, attack.pos.y)
        targetUnit = targetTile.unit
        score = attack.power * targetUnit.unitType.price
        score = score * 3 if targetUnit.capturing
        score = score * 2 if targetUnit.capturing and targetTile.owner == @playerNumber
        score = score * 2 if canCapture
        if attack.power < targetUnit.health
          oldHealth = targetUnit.health
          targetUnit.health -= attack.power
          counterDamage = @game.logic.calculateDamage(targetUnit, targetTile, unit, dst)
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
      scoreTile = (t) =>
        score = 100
        tIsCapturable = @game.terrainHasFlag(t.terrain, "Capturable")
        score = 0 if t.unit? and t.unit.owner == @playerNumber and t.beingCaptured
        score = score * 2 if tIsCapturable and t.owner == 0 and canCapture
        score = score * 2 if tIsCapturable and @game.logic.areEnemies(t.owner, @playerNumber) and canCapture
        score = score * 2 if tIsCapturable and @game.terrainCanBuild(t.terrain)

        path = @game.logic.getPath(unit.unitType.movementType, unit.owner, t.x, t.y, dst.x, dst.y, unit.unitType.movement, undefined, true)
        distance = if path then path[path.length - 1].cost else null
        distance = 1 if distance == 0
        return {tile: t, distance: distance, score: score}

      importantTiles = @game.getTiles(alliedTo: @playerNumber, hasUnit: true, unitEnemyOf: @playerNumber)

      if importantTiles.length < 5
        importantTiles = importantTiles.concat(@game.getTiles(capturable: true, enemyOf: @playerNumber, unitEnemyOfOrNoUnit: @playerNumber))

      if importantTiles.length < 5
        importantTiles = importantTiles.concat(@game.getTiles(unitEnemyOf: @playerNumber))

      importantTiles = ({tile: tile, distance: @game.logic.getDistance(tile.x, tile.y, dst.x, dst.y)} for tile in importantTiles)
      importantTiles.sort((a, b) -> a.distance - b.distance)
      importantTiles = importantTiles[..4];

      scoredTiles = (scoreTile(t.tile) for t in importantTiles)
      scoredTiles = (tile for tile in scoredTiles when tile.distance != null)
      score = 0
      if scoredTiles.length > 0
        totalDistance = sum(scoredTiles, (t) -> t.distance)
        score = sum((t.score / t.distance for t in scoredTiles)) / scoredTiles.length
        if (not canCapture) and neutralTile and capturable
          score = (if score > 0 then 0.01 else 100) * score
        if ownTile and buildTile
          score = (if score > 0 then 0.01 else 100) * score

      if score > bestAction.score
        bestAction = {
          score: score,
          action: "move",
          dst: dst
        }

    return bestAction

  performUnitAction: (unit, tile, action) ->
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
    getPower = (weaponId, armorId) =>
      weapon = @game.rules.weapons[weaponId]
      power = weapon?.powerMap[armorId]
      power = 0 if not power?
      return power

    getMaxPower = (attackerType, targetType) =>
      primaryPower = getPower(attackerType.primaryWeapon, targetType.armor)
      secondaryPower = getPower(attackerType.secondaryWeapon, targetType.armor)
      return if primaryPower > secondaryPower then primaryPower else secondaryPower

    getEfficiency = (attackerTypeId, targetTypeId) =>
      attackerType = @game.rules.units[attackerTypeId]
      targetType = @game.rules.units[targetTypeId]

      attackerPower = getMaxPower(attackerType, targetType)
      targetPower = getMaxPower(targetType, attackerType)
      targetPower = 1 if targetPower == 0

      return (attackerPower * targetType.price) / (targetPower * attackerType.price)

    getEfficienciesAgainst = (targetTypeId) =>
      ({unitTypeId: parseInt(attackerTypeId), efficiency: getEfficiency(attackerTypeId, targetTypeId)} for attackerTypeId of @game.rules.units)

    @efficiencies = ({unitTypeId: unitTypeId, efficiencies: getEfficienciesAgainst(unitTypeId)} for unitTypeId of @game.rules.units)

    #console.log ";" + (@game.rules.units[e.unitTypeId].name for e in @efficiencies).join(";")
    #for e in @efficiencies
    #  do (e) =>
    #    console.log @game.rules.units[e.unitTypeId].name + ";" + (eff.efficiency for eff in e.efficiencies).join(";")
    #

  getEfficiencies: (unitTypeId) -> (e.efficiencies for e in @efficiencies when e.unitTypeId is unitTypeId)[0]
