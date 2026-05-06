package net.lax1dude.eaglercraft.v1_8.infinitecraft;

public class InfiniteCraftResult {

	public final String name;
	public final boolean block;
	public final String[] colors;
	public final String[] pixels;
	public final boolean generatedTexture;

	public InfiniteCraftResult(String name, boolean block, String[] colors, String[] pixels) {
		this(name, block, colors, pixels, false);
	}

	public InfiniteCraftResult(String name, boolean block, String[] colors, String[] pixels, boolean generatedTexture) {
		this.name = name;
		this.block = block;
		this.colors = colors;
		this.pixels = pixels;
		this.generatedTexture = generatedTexture;
	}
}
