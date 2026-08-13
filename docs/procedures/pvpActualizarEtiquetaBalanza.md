# SP: pvpActualizarEtiquetaBalanza
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvEtiquetaBalanza`](../tables/pvEtiquetaBalanza.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pvpActualizarEtiquetaBalanza
*DESCRIPCIÓN	: Actualiza una etiqueta para balanza
*AUTOR			: SOFTECH SISTEMAS
*CREACIÓN		: 09/09/2013
*ACTUALIZACIÓN	: 16/09/2020
**************************************************************************/ 
CREATE PROCEDURE [dbo].[pvpActualizarEtiquetaBalanza]
    (
      @sCo_Etiqueta			CHAR(6) ,
      @sDes_Etiqueta		VARCHAR(60) ,
      @sCo_EtiquetaOri		CHAR(6) ,
      @iPre					INTEGER ,
      @iCod					INTEGER ,
      @iSuf					INTEGER ,
      @iEnt					INTEGER ,
      @iDec					INTEGER ,
      @iAdic				INTEGER ,
      @bActivo				BIT,
      @sCampo1				VARCHAR(60) = NULL ,
      @sCampo2				VARCHAR(60) = NULL ,
      @sCampo3				VARCHAR(60) = NULL ,
      @sCampo4				VARCHAR(60) = NULL ,
      @sCampo5				VARCHAR(60) = NULL ,
      @sCampo6				VARCHAR(60) = NULL ,
      @sCampo7				VARCHAR(60) = NULL ,
      @sCampo8				VARCHAR(60) = NULL ,
      @sCo_Sucu_In			CHAR(6)		= NULL,
      @sCo_us_mo			CHAR (6),
      @sCo_sucu_mo			CHAR (6)	= NULL,
      @sMaquina				VARCHAR(60) = NULL ,
      @sCampos				VARCHAR(MAX)= NULL ,
      @sRevisado			CHAR(1)		= NULL ,
      @sTrasnfe				CHAR(1)		= NULL,
      @tsValidador			TIMESTAMP ,
      @gRowguid				UNIQUEIDENTIFIER = NULL 
-->>JN 20200826
	,@sPeso_precio		CHAR(2) = NULL
--<<JN 20200826 
    )
AS 
    BEGIN	

        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        UPDATE
            pvEtiquetaBalanza
        SET 
        
            co_Etiqueta = @sCo_Etiqueta, des_Etiqueta = @sDes_Etiqueta, pre = @iPre, cod = @iCod, suf = @iSuf, ent = @iEnt, dec = @iDec, adic= @iAdic, activo = @bActivo,
            campo1 = @sCampo1, campo2 = @sCampo2, campo3 = @sCampo3, campo4 = @sCampo4, campo5 = @sCampo5, campo6 = @sCampo6,
            campo7 = @sCampo7, campo8 = @sCampo8, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_mo, fe_us_mo = GETDATE(),revisado = @sRevisado, trasnfe = @sTrasnfe
			-->>JN 20200826
			, peso_precio = @sPeso_precio
			--<<JN 20200826
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_Etiqueta = @sCo_EtiquetaOri
            AND validador = @t
```
