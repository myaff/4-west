import Card from './Card.js';
import Game from './Game.js';
import TaskQueue from './TaskQueue.js';
import SpeedRate from './SpeedRate.js';

// Отвечает является ли карта уткой.
function isDuck(card) {
    return card && card.quacks && card.swims;
}

// Отвечает является ли карта собакой.
function isDog(card) {
    return card instanceof Dog;
}

// Дает описание существа по схожести с утками и собаками
function getCreatureDescription(card) {
    if (isDuck(card) && isDog(card)) {
        return 'Утка-Собака';
    }
    if (isDuck(card)) {
        return 'Утка';
    }
    if (isDog(card)) {
        return 'Собака';
    }
    return 'Существо';
}

class Creature extends Card {
    constructor(name, maxPower, image) {
        super(name, maxPower, image);
        this._currentPower = maxPower;
    }

    get currentPower() {
        return this._currentPower;
    }
    set currentPower(value) {
        this._currentPower = Math.min(value, this.maxPower);
    }

    getDescriptions() {
        return [
            getCreatureDescription(this),
            ...super.getDescriptions(),
        ];
    }
}


// Основа для утки.
class Duck extends Creature {
    constructor(name = 'Мирная утка', maxPower = 2) {
        super(name, maxPower);
    }

    quacks() {
        console.log('quack');
    }

    swims() {
        console.log('float: both;');
    }
}


// Основа для собаки.
class Dog extends Creature {
    constructor(name = 'Пес-бандит', maxPower = 3) {
        super(name, maxPower);
    }
}

class Trasher extends Dog {
    constructor(name = 'Громила', maxPower = 5) {
        super(name, maxPower);
    }

    modifyTakenDamage(value, fromCard, gameContext, continuation) {
        this.view.signalAbility(() => super.modifyTakenDamage(value - 1, fromCard, gameContext, continuation));
    }

    getDescriptions() {
        return [
            'Получает на 1 меньше урона',
            ...super.getDescriptions(),
        ];
    }
}

class Gatling extends Creature {
    constructor(name = 'Гатлинг', maxPower = 6) {
        super(name, maxPower);
    }

    attack(gameContext, continuation) {
        const { oppositePlayer } = gameContext;
        const taskQueue = new TaskQueue();
        for (let card of oppositePlayer.table) {
            taskQueue.push(onDone => this.view.showAttack(onDone));
            taskQueue.push(onDone => {
                this.view.signalAbility(() => {
                    this.dealDamageToCreature(2, card, gameContext, onDone);
                })
            });
        }
        taskQueue.continueWith(continuation);
    }
}

class Lad extends Dog {
    constructor(name = 'Браток', maxPower = 2) {
        super(name, maxPower);
    }

    static getInGameCount() {
        return this.inGameCount || 0;
    }
    static setInGameCount(value) {
        this.inGameCount = value;
    }
    static getBonus() {
        const bonus = this.getInGameCount() * (this.getInGameCount() + 1) / 2;
        return {
            safety: bonus,
            damage: bonus,
        };
    }

    doAfterComingIntoPlay(gameContext, continuation) {
        Lad.setInGameCount(Lad.getInGameCount() + 1);
        super.doAfterComingIntoPlay(gameContext, continuation);
    }

    doBeforeRemoving(continuation) {
        Lad.setInGameCount(Lad.getInGameCount() - 1);
        super.doBeforeRemoving(continuation);
    }

    modifyDealedDamageToCreature(value, toCard, gameContext, continuation) {
        const { damage } = Lad.getBonus();
        this.view.signalAbility(() => {
            super.modifyDealedDamageToCreature(value + damage, toCard, gameContext, continuation);
        });
    }

    modifyTakenDamage(value, fromCard, gameContext, continuation) {
        const { safety } = Lad.getBonus();
        this.view.signalAbility(() => {
            super.modifyTakenDamage(value - safety, fromCard, gameContext, continuation);
        });
    }

    getDescriptions() {
        const descriptions = [...super.getDescriptions()];
        if (Lad.prototype.hasOwnProperty('modifyDealedDamageToCreature') && Lad.prototype.hasOwnProperty('modifyTakenDamage')) {
            descriptions.unshift('Чем их больше, тем они сильнее');
        }
        return descriptions;
    }
}

class Rogue extends Creature {
    constructor(name = 'Изгой', maxPower = 2) {
        super(name, maxPower);
    }

    doBeforeAttack(gameContext, continuation) {
        const { oppositePlayer, position, updateView } = gameContext;
        const oppositeCard = oppositePlayer.table[position];
        if (oppositeCard) {
            const oppositeCardProto = Object.getPrototypeOf(oppositeCard);
            const abilities = ['modifyDealedDamageToCreature', 'modifyDealedDamageToPlayer', 'modifyTakenDamage'];
            this.view.signalAbility(() => {
                for (let ability of abilities) {
                    if (oppositeCardProto.hasOwnProperty(ability)) {
                        delete oppositeCardProto[ability];
                    }
                }
                updateView();
                super.doBeforeAttack(gameContext, continuation);
            });
        } else super.doBeforeAttack(gameContext, continuation);
    }
}

class Brewer extends Duck {
    constructor(name = 'Пивовар', maxPower = 2) {
        super(name, maxPower);
    }

    doBeforeAttack(gameContext, continuation) {
        const { currentPlayer, oppositePlayer } = gameContext;
        const ducks = [...currentPlayer.table, ...oppositePlayer.table].filter(card => isDuck(card));
        this.view.signalAbility(() => {
            ducks.forEach(card => {
                card.maxPower += 1;
                card.currentPower += 2;
                card.view.signalHeal(() => card.updateView());
            })
            super.doBeforeAttack(gameContext, continuation);
        })
    }
}

class PseudoDuck extends Dog {
    constructor(name = 'Псевдоутка', maxPower = 3) {
        super(name, maxPower);
        this.quacks = Duck.prototype.quacks.bind(this);
        this.swims = Duck.prototype.swims.bind(this);
    }
}

class Nemo extends Creature {
    constructor(name = 'Немо', maxPower = 4) {
        super(name, maxPower);
    }

    doBeforeAttack(gameContext, continuation) {
        const { oppositePlayer, position, updateView } = gameContext;
        const oppositeCard = oppositePlayer.table[position];
        if (oppositeCard) {
            const proto = Object.getPrototypeOf(oppositeCard);
            this.view.signalAbility(() => {
                Object.setPrototypeOf(this, proto);
                updateView();
                this.doBeforeAttack(gameContext, continuation);
            });
        } else super.doBeforeAttack(gameContext, continuation);
    }
}


// Колода Шерифа, нижнего игрока.
const seriffStartDeck = [
    new Duck(),
    new Brewer(),
    new Duck(),
    new Gatling(),
    new Duck(),
    new Duck(),
    new Duck(),
    new Rogue(),
    new Nemo(),
];

// Колода Бандита, верхнего игрока.
const banditStartDeck = [
    new Trasher(),
    new Dog(),
    new PseudoDuck(),
    new PseudoDuck(),
    new Dog(),
    new PseudoDuck(),
    new Lad(),
    new Lad(),
    new Lad(),
    new Brewer(),
];


// Создание игры.
const game = new Game(seriffStartDeck, banditStartDeck);

// Глобальный объект, позволяющий управлять скоростью всех анимаций.
SpeedRate.set(1);

// Запуск игры.
game.play(false, (winner) => {
    alert('Победил ' + winner.name);
});
