package net.minecraft.client.gui.inventory;

import net.lax1dude.eaglercraft.v1_8.infinitecraft.InfiniteCraftCallback;
import net.lax1dude.eaglercraft.v1_8.infinitecraft.InfiniteCraftGeminiClient;
import net.lax1dude.eaglercraft.v1_8.infinitecraft.InfiniteCraftResult;
import net.lax1dude.eaglercraft.v1_8.opengl.GlStateManager;

import net.minecraft.client.gui.GuiButton;
import net.minecraft.client.gui.GuiScreen;
import net.minecraft.init.Blocks;
import net.minecraft.init.Items;
import net.minecraft.inventory.Container;
import net.minecraft.item.ItemStack;
import net.minecraft.util.BlockPos;
import net.minecraft.world.World;
import net.minecraft.entity.player.InventoryPlayer;

public class GuiCrafting extends GuiScreen {

	private static final String[] BASE_ELEMENTS = new String[] { "Fire", "Water", "Wind", "Earth" };
	private static final int[] BASE_COLORS = new int[] { 0xFF4B1F, 0x3FA7FF, 0xDCEBFF, 0x8A5A2B };
	private static final int MAX_VISIBLE_ELEMENTS = 12;

	private final InventoryPlayer playerInventory;
	@SuppressWarnings("unused")
	private final World world;
	@SuppressWarnings("unused")
	private final BlockPos position;
	private String leftElement;
	private String rightElement;
	private InfiniteCraftResult result;
	private String status = "Choose two elements";
	private String lastResultName;
	private String[] visibleElements = BASE_ELEMENTS;
	private boolean combining = false;

	public GuiCrafting(InventoryPlayer playerInv, World worldIn) {
		this(playerInv, worldIn, new BlockPos(0, 0, 0));
	}

	public GuiCrafting(InventoryPlayer playerInv, World worldIn, BlockPos blockPosition) {
		this.playerInventory = playerInv;
		this.world = worldIn;
		this.position = blockPosition;
	}

	public void initGui() {
		this.buttonList.clear();
		this.visibleElements = buildVisibleElements();
		int cx = this.width / 2;
		int y = this.height / 2 - 70;
		for (int i = 0; i < visibleElements.length; ++i) {
			int row = i / 4;
			int col = i % 4;
			this.buttonList.add(new GuiButton(10 + i, cx - 154 + col * 78, y + row * 24, 72, 20,
					shortButtonName(visibleElements[i])));
		}
		this.buttonList.add(new GuiButton(1, cx - 102, y + 92, 98, 20, "Clear"));
		this.buttonList.add(new GuiButton(2, cx + 4, y + 92, 98, 20, "Combine"));
	}

	protected void actionPerformed(GuiButton button) {
		if (button.id >= 10 && button.id < 10 + visibleElements.length) {
			selectElement(visibleElements[button.id - 10]);
			return;
		}
		if (button.id == 1) {
			leftElement = null;
			rightElement = null;
			result = null;
			status = "Choose two elements";
			return;
		}
		if (button.id == 2) {
			combine();
		}
	}

	private void selectElement(String element) {
		if (leftElement == null) {
			leftElement = element;
		} else if (rightElement == null) {
			rightElement = element;
		} else {
			leftElement = rightElement;
			rightElement = element;
		}
		result = null;
		status = "Ready";
	}

	private void combine() {
		if (combining) {
			return;
		}
		if (leftElement == null || rightElement == null) {
			status = "Pick two elements first";
			return;
		}
		combining = true;
		status = "Asking Gemini...";
		InfiniteCraftGeminiClient.combine(leftElement, rightElement, new InfiniteCraftCallback() {
			public void onComplete(InfiniteCraftResult resultIn) {
				result = resultIn;
				combining = false;
				lastResultName = result.name;
				status = "Created " + result.name + ", texture loading...";
				giveResult(result);
			}

			public void onTexture(InfiniteCraftResult resultIn) {
				result = resultIn;
				lastResultName = result.name;
				status = "Texture ready for " + result.name;
				initGui();
			}

			public void onFailure(String message) {
				combining = false;
				status = "Failed: " + message;
			}
		});
	}

	private void giveResult(InfiniteCraftResult res) {
		ItemStack stack;
		if (res.block) {
			stack = new ItemStack(Blocks.stained_hardened_clay, 1, colorMeta(res.colors));
		} else {
			stack = new ItemStack(Items.paper, 1);
		}
		stack.setStackDisplayName(res.name);
		if (!this.playerInventory.addItemStackToInventory(stack)) {
			this.mc.thePlayer.dropPlayerItemWithRandomChoice(stack, false);
		}
	}

	private String[] buildVisibleElements() {
		String[] elements = new String[MAX_VISIBLE_ELEMENTS];
		int count = 0;
		for (int i = 0; i < BASE_ELEMENTS.length && count < elements.length; ++i) {
			elements[count++] = BASE_ELEMENTS[i];
		}
		if (this.playerInventory != null && this.playerInventory.mainInventory != null) {
			for (int i = 0; i < this.playerInventory.mainInventory.length && count < elements.length; ++i) {
				ItemStack stack = this.playerInventory.mainInventory[i];
				if (stack != null) {
					String name = stack.getDisplayName();
					if (name != null && name.length() > 0 && !contains(elements, count, name)) {
						elements[count++] = name;
					}
				}
			}
		}
		String[] ret = new String[count];
		for (int i = 0; i < count; ++i) {
			ret[i] = elements[i];
		}
		return ret;
	}

	private boolean contains(String[] elements, int count, String name) {
		for (int i = 0; i < count; ++i) {
			if (name.equals(elements[i])) {
				return true;
			}
		}
		return false;
	}

	private String shortButtonName(String name) {
		if (name != null && name.length() > 10) {
			return name.substring(0, 9) + ".";
		}
		return name;
	}

	private int colorMeta(String[] colors) {
		if (colors == null || colors.length == 0) {
			return 0;
		}
		int r = 0;
		int g = 0;
		int b = 0;
		int count = 0;
		for (int i = 0; i < colors.length; ++i) {
			String s = colors[i];
			if (s != null && s.length() == 7 && s.charAt(0) == '#') {
				try {
					r += Integer.parseInt(s.substring(1, 3), 16);
					g += Integer.parseInt(s.substring(3, 5), 16);
					b += Integer.parseInt(s.substring(5, 7), 16);
					++count;
				} catch (NumberFormatException ex) {
					;
				}
			}
		}
		if (count == 0) {
			return 0;
		}
		r /= count;
		g /= count;
		b /= count;
		if (b > r && b > g) {
			return 11;
		}
		if (g > r && g > b) {
			return 13;
		}
		if (r > 190 && g > 120) {
			return 4;
		}
		if (r > g && r > b) {
			return 14;
		}
		return 8;
	}

	public void drawScreen(int mouseX, int mouseY, float partialTicks) {
		this.drawDefaultBackground();
		int cx = this.width / 2;
		int top = this.height / 2 - 98;
		this.drawCenteredString(this.fontRendererObj, "Infinite Crafting Table", cx, top, 0xFFFFFF);
		this.drawCenteredString(this.fontRendererObj, status, cx, top + 16, 0xFFFF55);
		drawSlot(cx - 76, top + 50, leftElement);
		drawSlot(cx + 44, top + 50, rightElement);
		this.drawCenteredString(this.fontRendererObj, "+", cx, top + 58, 0xFFFFFF);
		if (result != null) {
			this.drawCenteredString(this.fontRendererObj, result.name, cx, top + 126, 0xFFFFFF);
			drawPreview(cx - 8, top + 144, result);
			if (!result.generatedTexture) {
				this.drawCenteredString(this.fontRendererObj, "base texture", cx, top + 181, 0xAAAAAA);
			}
		} else if (lastResultName != null) {
			this.drawCenteredString(this.fontRendererObj, lastResultName, cx, top + 126, 0xFFFFFF);
		}
		super.drawScreen(mouseX, mouseY, partialTicks);
	}

	private void drawSlot(int x, int y, String element) {
		drawRect(x, y, x + 32, y + 32, 0xFF202020);
		drawRect(x + 1, y + 1, x + 31, y + 31, 0xFF4A4A4A);
		if (element != null) {
			int color = colorForElement(element);
			drawRect(x + 6, y + 6, x + 26, y + 26, 0xFF000000 | color);
			this.drawCenteredString(this.fontRendererObj, element, x + 16, y + 38, 0xFFFFFF);
		}
	}

	private int colorForElement(String element) {
		for (int i = 0; i < BASE_ELEMENTS.length; ++i) {
			if (BASE_ELEMENTS[i].equals(element)) {
				return BASE_COLORS[i];
			}
		}
		return 0xAAAAAA;
	}

	private void drawPreview(int x, int y, InfiniteCraftResult res) {
		String[] pixels = res.pixels;
		String[] colors = res.colors;
		if (pixels == null || colors == null || colors.length == 0) {
			return;
		}
		GlStateManager.disableTexture2D();
		for (int py = 0; py < 16 && py < pixels.length; ++py) {
			String row = pixels[py];
			for (int px = 0; px < 16 && px < row.length(); ++px) {
				int idx = row.charAt(px) - '0';
				if (idx < 0) {
					idx = 0;
				}
				String color = colors[idx % colors.length];
				drawRect(x + px * 2, y + py * 2, x + px * 2 + 2, y + py * 2 + 2, 0xFF000000 | parseColor(color));
			}
		}
		GlStateManager.enableTexture2D();
	}

	private int parseColor(String color) {
		if (color != null && color.length() == 7 && color.charAt(0) == '#') {
			try {
				return Integer.parseInt(color.substring(1), 16);
			} catch (NumberFormatException ex) {
				return 0xAAAAAA;
			}
		}
		return 0xAAAAAA;
	}

	public boolean doesGuiPauseGame() {
		return false;
	}

	public Container getContainer() {
		return null;
	}
}
