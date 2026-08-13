# SP: pInsertarCompuesto
**Tipo**: Insertar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCompuesto`](../tables/saArtCompuesto.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pInsertarCompuesto
*DESCRIPCIÓN	: Inserta un Compuesto
*AUTOR			: SOFTECH SISTEMAS
*MODIFICADO POR: SOFTECH SISTEMAS (29/07/2009)
*MODIFICADO POR: SOFTECH SISTEMAS (19-08-2009)
*************************************************************************/

CREATE PROCEDURE [pInsertarCompuesto]
    (
      @sCo_ArtC CHAR(20) ,
      @sCo_Art CHAR(30) ,
      @sCo_Uni CHAR(6) ,
      @sdFec_Emis SMALLDATETIME ,
      @sDescrip VARCHAR(60) = NULL ,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL
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

        INSERT  INTO saArtCompuesto
                ( co_artc, co_art, co_uni, fec_emis, descrip, campo1, campo2, campo3, campo4, campo5, campo6, campo7,
                  campo8, co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, trasnfe )
        OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCo_ArtC, @sCo_Art, @sCo_Uni, @sdFec_Emis, @sDescrip, @sCampo1, @sCampo2, @sCampo3, @sCampo4,
                  @sCampo5, @sCampo6, @sCampo7, @sCampo8, @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sCo_Us_In, @sCo_Sucu_In,
                  GETDATE(), @sRevisado, @sTrasnfe )
		
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saArtCompuesto', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sCo_ArtC
		
        SELECT
            *
        FROM
```
