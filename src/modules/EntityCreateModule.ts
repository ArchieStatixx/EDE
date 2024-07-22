import { EventHandler } from "../core/handler/EventHandler";
import { Module } from "../core/Module";
import { Violation } from "../core/Violation";
import { Config } from "../core/config/Config";
import { Utility } from "../util/Utility";
import { container } from "tsyringe";

export class EntityCreateModule extends Module {
	private _illegalEntities: Set<number> = new Set();
	private _blacklistedWeapons: Set<number> = new Set();
	private _banNetworkOwner: boolean = false;
	private _checkPedsForWeapons: boolean = false;

	constructor() {
		super(container.resolve(Config), container.resolve(EventHandler));
	}

	public onLoad(): void {
		this._illegalEntities = new Set(Utility.hashify(this.config.IllegalModels));
		this._banNetworkOwner = Config.getValue<boolean>(this.config, "banNetworkOwner");
		this._checkPedsForWeapons = Config.getValue<boolean>(this.config, "checkPedsForWeapons");
		if (this._checkPedsForWeapons) {
			this._blacklistedWeapons = new Set(Utility.hashify(this.config.BlacklistedWeapons));
		}
		this.eventHandler.subscribe("entityCreating", this.onEntityCreated.bind(this));
	}

	public onUnload(): void {
		this.eventHandler.unsubscribe("entityCreating", this.onEntityCreated.bind(this));
	}

	/**
	 * Called when an entity is created.
	 * @param entity The entity that was created.
	 */
	private onEntityCreated(entity: number): void {
		// If the entity is illegal, ban the player.
		if (this._illegalEntities.has(GetEntityModel(entity))) {
			const owner: number = NetworkGetFirstEntityOwner(entity);
			this.handleViolation("Illegal Entity [Vehicle Owned]", owner, entity);
			return;
		}

		// If the entity is a ped and the owner is not a player and the selected weapon is blacklisted, ban the player.
		if (this._checkPedsForWeapons) {
			if (GetEntityType(entity) === 1 && this._blacklistedWeapons.has(GetSelectedPedWeapon(entity))) {
				const owner: number = NetworkGetFirstEntityOwner(entity);
				this.handleViolation("Illegal Entity [Weapon]", owner, entity);
				return;
			}
		}
	}

	/**
	 * Handles a violation by banning the network owner and deleting the specific entity.
	 * @param violationType - The type of violation.
	 * @param owner - The network owner of the entity.
	 * @param entity - The specific entity to be deleted.
	 */
	private handleViolation(violationType: string, owner: number, entity: number): void {
		if (this._banNetworkOwner) {
			const violation = new Violation(owner, violationType, this.name);
			violation.banPlayer();
		}
		if (entity) {
			DeleteEntity(entity);  // Directly delete the specific illegal entity.
		}
		CancelEvent();
	}
}
