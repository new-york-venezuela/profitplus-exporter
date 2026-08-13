# SP: pv_InsertarArticuloExt
**Tipo**: PV-Insertar
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvArticuloExt`](../tables/pvArticuloExt.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: [pv_InsertarArticuloExt]
*DESCRIPCIÓN	: ACTUALIZA EL ARTICULO EN LA TABLA EXTENDIDA 'pvArticuloExt' DE UN ARTICULO EXISTENTE EN LA MISMA TABLA.
				  SI EL ARTICULO NO EXISTE EN LA TABLA EXTENDIDA LO INSERTA, SP USADO POR ADM 8.0
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/ 

CREATE PROCEDURE [dbo].[pv_InsertarArticuloExt]
    (
		@rowguid_CoArt			UNIQUEIDENTIFIER ,
		@bCampoObligatorio		BIT,
		@bDescripRenglon		BIT,
		@sDescripRenglonTxt		VARCHAR(32) ,
		@sCo_Us_In				CHAR(6) ,
		@sCo_Us_Mo				CHAR(6) ,
		@sCo_Sucu_In			CHAR(6) ,
		@sCo_Sucu_Mo			CHAR(6) ,
		@sMaquina				VARCHAR(60)		= NULL,
		@tsValidador			TIMESTAMP		= NULL
    )
AS 
BEGIN
	DECLARE @fechaLocal AS DATETIME
	SET @fechaLocal = GETDATE()

	IF EXISTS(SELECT [id] FROM pvArticuloExt WHERE id = @rowguid_CoArt)
	BEGIN
		UPDATE pvArticuloExt 
		SET  DescripRenglon = @bDescripRenglon, DescripRenglonTxt = @sDescripRenglonTxt, CampoObligatorio = @bCampoObligatorio,
		co_us_mo = @sCo_Us_Mo, fe_us_mo = @fechaLocal, co_sucu_mo = @sCo_Sucu_Mo
		WHERE Id = @rowguid_CoArt AND validador = @tsValidador
	
		IF @@ROWCOUNT > 0
		BEGIN
			EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @fechaLocal, @sCo_Sucu = @sCo_Sucu_mo,
				@sTablaOri = 'pvArticuloExt', @rowguidOri = @rowguid_CoArt, @sTipo_Op = 'M', @sMaquina = @sMaquina,
				@sCampos = ''	
		END
	END
	ELSE
	BEGIN
		INSERT INTO pvArticuloExt (Id, DescripRenglon, DescripRenglonTxt, CampoObligatorio,
		co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo )
			VALUES
		(@rowguid_CoArt, @bDescripRenglon,@sDescripRenglonTxt,@bCampoObligatorio,
		@sCo_Us_In, @sCo_Sucu_In,@fechaLocal, @sCo_Us_in, @sCo_Sucu_in,@fechaLocal)
		
		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @fechaLocal, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'pvArticuloExt', @rowguidOri = @rowguid_CoArt, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = ''		
   END
END
```
