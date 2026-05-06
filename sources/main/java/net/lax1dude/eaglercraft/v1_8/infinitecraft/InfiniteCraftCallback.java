package net.lax1dude.eaglercraft.v1_8.infinitecraft;

public interface InfiniteCraftCallback {

	void onComplete(InfiniteCraftResult result);

	void onTexture(InfiniteCraftResult result);

	void onFailure(String message);
}
