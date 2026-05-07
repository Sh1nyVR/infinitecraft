package net.minecraft.client.gui.inventory;

import net.lax1dude.eaglercraft.v1_8.infinitecraft.InfiniteCraftCallback;
import net.lax1dude.eaglercraft.v1_8.infinitecraft.InfiniteCraftGeminiClient;
import net.lax1dude.eaglercraft.v1_8.infinitecraft.InfiniteCraftResult;
import net.lax1dude.eaglercraft.v1_8.opengl.GlStateManager;

import net.minecraft.client.gui.GuiButton;
import net.minecraft.entity.player.EntityPlayer;
import net.minecraft.init.Items;
import net.minecraft.inventory.Container;
import net.minecraft.inventory.InventoryBasic;
import net.minecraft.inventory.Slot;
import net.minecraft.item.ItemStack;
import net.minecraft.nbt.NBTTagCompound;
import net.minecraft.nbt.NBTTagList;
import net.minecraft.nbt.NBTTagString;
import net.minecraft.util.BlockPos;
import net.minecraft.util.ResourceLocation;
import net.minecraft.world.World;
import net.minecraft.entity.player.InventoryPlayer;

public class GuiCrafting extends GuiContainer {

	private static final String[] BASE_ELEMENTS = new String[] { "Fire", "Water", "Wind", "Earth" };
	private static final int[] BASE_COLORS = new int[] { 0xFF4B1F, 0x3FA7FF, 0xDCEBFF, 0x8A5A2B };
	private static final ResourceLocation CRAFTING_TABLE_GUI_TEXTURES = new ResourceLocation(
			"textures/gui/container/crafting_table.png");

	private final InventoryPlayer playerInventory;
	@SuppressWarnings("unused")
	private final World world;
	@SuppressWarnings("unused")
	private final BlockPos position;
	private final InfiniteCraftContainer infiniteContainer;
	private String leftElement;
	private String rightElement;
	private InfiniteCraftResult result;
	private String status = "Choose two ingredients";
	private String lastResultName;
	private boolean combining = false;

	public GuiCrafting(InventoryPlayer playerInv, World worldIn) {
		this(playerInv, worldIn, new BlockPos(0, 0, 0));
	}

	public GuiCrafting(InventoryPlayer playerInv, World worldIn, BlockPos blockPosition) {
		super(new InfiniteCraftContainer(playerInv));
		this.playerInventory = playerInv;
		this.world = worldIn;
		this.position = blockPosition;
		this.infiniteContainer = (InfiniteCraftContainer) this.inventorySlots;
		this.xSize = 176;
		this.ySize = 196;
	}

	public void initGui() {
		super.initGui();
		this.buttonList.clear();
		int y = this.guiTop + 6;
		for (int i = 0; i < BASE_ELEMENTS.length; ++i) {
			this.buttonList.add(new GuiButton(10 + i, this.guiLeft + 8 + i * 40, y, 36, 18, BASE_ELEMENTS[i]));
		}
		this.buttonList.add(new GuiButton(1, this.guiLeft + 8, this.guiTop + 70, 52, 18, "Clear"));
		this.buttonList.add(new GuiButton(2, this.guiLeft + 116, this.guiTop + 70, 52, 18, "Combine"));
	}

	protected void actionPerformed(GuiButton button) {
		if (button.id >= 10 && button.id < 10 + BASE_ELEMENTS.length) {
			selectElement(BASE_ELEMENTS[button.id - 10]);
			return;
		}
		if (button.id == 1) {
			leftElement = null;
			rightElement = null;
			result = null;
			status = "Choose two ingredients";
			clearInputSlots();
			return;
		}
		if (button.id == 2) {
			combine();
		}
	}

	private void selectElement(String element) {
		if (leftInputStack() == null && leftElement == null) {
			leftElement = element;
		} else if (rightInputStack() == null && rightElement == null) {
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
		final String left = ingredientName(0, leftElement);
		final String right = ingredientName(1, rightElement);
		if (left == null || right == null) {
			status = "Put two ingredients in the top grid slots";
			return;
		}
		combining = true;
		status = "Asking Groq...";
		InfiniteCraftGeminiClient.combine(left, right, new InfiniteCraftCallback() {
			public void onComplete(InfiniteCraftResult resultIn) {
				result = resultIn;
				combining = false;
				lastResultName = result.name;
				status = "Created " + result.name + ", texture loading...";
				consumeInputs();
				giveResult(result);
			}

			public void onTexture(InfiniteCraftResult resultIn) {
				result = resultIn;
				lastResultName = result.name;
				status = "Texture ready for " + result.name;
				if (mc.currentScreen == GuiCrafting.this) {
					initGui();
				}
			}

			public void onFailure(String message) {
				combining = false;
				status = "Failed: " + message;
			}
		});
	}

	private void consumeInputs() {
		consumeInputSlot(0);
		consumeInputSlot(1);
		leftElement = null;
		rightElement = null;
	}

	private void consumeInputSlot(int index) {
		ItemStack stack = this.infiniteContainer.inputInventory.getStackInSlot(index);
		if (stack != null) {
			--stack.stackSize;
			if (stack.stackSize <= 0) {
				this.infiniteContainer.inputInventory.setInventorySlotContents(index, null);
			}
		}
	}

	private void clearInputSlots() {
		for (int i = 0; i < 2; ++i) {
			ItemStack stack = this.infiniteContainer.inputInventory.getStackInSlot(i);
			if (stack != null) {
				if (!this.playerInventory.addItemStackToInventory(stack)) {
					this.mc.thePlayer.dropPlayerItemWithRandomChoice(stack, false);
				}
				this.infiniteContainer.inputInventory.setInventorySlotContents(i, null);
			}
		}
	}

	private ItemStack leftInputStack() {
		return this.infiniteContainer.inputInventory.getStackInSlot(0);
	}

	private ItemStack rightInputStack() {
		return this.infiniteContainer.inputInventory.getStackInSlot(1);
	}

	private String ingredientName(int slot, String fallback) {
		ItemStack stack = this.infiniteContainer.inputInventory.getStackInSlot(slot);
		if (stack != null) {
			String name = stack.getDisplayName();
			if (name != null && name.length() > 0) {
				return name;
			}
		}
		return fallback;
	}

	private void giveResult(InfiniteCraftResult res) {
		ItemStack stack = new ItemStack(Items.paper, 1);
		NBTTagCompound tag = new NBTTagCompound();
		NBTTagCompound infinite = new NBTTagCompound();
		infinite.setString("Name", res.name);
		infinite.setBoolean("Block", res.block);
		infinite.setBoolean("GeneratedTexture", res.generatedTexture);
		tag.setTag("InfiniteCraft", infinite);
		NBTTagCompound display = new NBTTagCompound();
		NBTTagList lore = new NBTTagList();
		lore.appendTag(new NBTTagString(res.block ? "InfiniteCraft block discovery" : "InfiniteCraft item discovery"));
		lore.appendTag(new NBTTagString("Texture " + (res.generatedTexture ? "generated" : "pending")));
		display.setTag("Lore", lore);
		tag.setTag("display", display);
		stack.setTagCompound(tag);
		stack.setStackDisplayName(res.name);
		if (!this.playerInventory.addItemStackToInventory(stack)) {
			this.mc.thePlayer.dropPlayerItemWithRandomChoice(stack, false);
		}
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
		super.drawScreen(mouseX, mouseY, partialTicks);
	}

	protected void drawGuiContainerForegroundLayer(int mouseX, int mouseY) {
		this.fontRendererObj.drawString("Infinite Crafting", 8, 92, 0x404040);
		this.fontRendererObj.drawString(this.playerInventory.getDisplayName().getUnformattedText(), 8, this.ySize - 96 + 2,
				0x404040);
		this.drawCenteredString(this.fontRendererObj, status, this.xSize / 2, 28, 0xFFFF55);
		drawVirtualSlotLabel(30, 36, ingredientName(0, leftElement));
		drawVirtualSlotLabel(48, 36, ingredientName(1, rightElement));
		if (result != null) {
			this.drawCenteredString(this.fontRendererObj, result.name, this.xSize / 2, 112, 0xFFFFFF);
			drawPreview(this.xSize / 2 - 16, 124, result);
		} else if (lastResultName != null) {
			this.drawCenteredString(this.fontRendererObj, lastResultName, this.xSize / 2, 112, 0xFFFFFF);
		}
	}

	private void drawVirtualSlotLabel(int x, int y, String element) {
		if (element != null) {
			String shortName = element.length() > 12 ? element.substring(0, 11) + "." : element;
			this.drawCenteredString(this.fontRendererObj, shortName, x + 8, y + 20, 0xFFFFFF);
		}
	}

	protected void drawGuiContainerBackgroundLayer(float partialTicks, int mouseX, int mouseY) {
		GlStateManager.color(1.0F, 1.0F, 1.0F, 1.0F);
		this.mc.getTextureManager().bindTexture(CRAFTING_TABLE_GUI_TEXTURES);
		this.drawTexturedModalRect(this.guiLeft, this.guiTop, 0, 0, this.xSize, 166);
		drawRect(this.guiLeft, this.guiTop + 88, this.guiLeft + this.xSize, this.guiTop + this.ySize, 0xC0101010);
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

	public void onGuiClosed() {
		super.onGuiClosed();
		clearInputSlots();
	}

	public boolean doesGuiPauseGame() {
		return false;
	}

	public Container getContainer() {
		return this.inventorySlots;
	}

	private static class InfiniteCraftContainer extends Container {

		private final InventoryBasic inputInventory = new InventoryBasic("Infinite Craft", false, 2);

		private InfiniteCraftContainer(InventoryPlayer playerInv) {
			this.addSlotToContainer(new Slot(inputInventory, 0, 30, 36));
			this.addSlotToContainer(new Slot(inputInventory, 1, 48, 36));

			for (int row = 0; row < 3; ++row) {
				for (int col = 0; col < 9; ++col) {
					this.addSlotToContainer(new Slot(playerInv, col + row * 9 + 9, 8 + col * 18, 114 + row * 18));
				}
			}

			for (int col = 0; col < 9; ++col) {
				this.addSlotToContainer(new Slot(playerInv, col, 8 + col * 18, 172));
			}
		}

		public boolean canInteractWith(EntityPlayer playerIn) {
			return true;
		}

		public ItemStack transferStackInSlot(EntityPlayer playerIn, int index) {
			return null;
		}

		public void onContainerClosed(EntityPlayer playerIn) {
			super.onContainerClosed(playerIn);
			for (int i = 0; i < 2; ++i) {
				ItemStack stack = this.inputInventory.getStackInSlot(i);
				if (stack != null) {
					playerIn.dropPlayerItemWithRandomChoice(stack, false);
					this.inputInventory.setInventorySlotContents(i, null);
				}
			}
		}
	}
}
