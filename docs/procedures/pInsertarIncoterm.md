# SP: pInsertarIncoterm
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saIncoterm`](../tables/saIncoterm.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pInsertarIncoterm
DESCRIPCION: Insertar Tabla Incoterm
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pInsertarIncoterm]
    (
      @sCo_Incoterm CHAR(6) ,
      @sIncoterm_Des VARCHAR(60) ,
      @deSecuencia int ,
	  @bMaritimo bit ,
	  @bAereo bit ,
	  @bTerrestre bit ,
	  @sdescrip_detallada VARCHAR(MAX) = NULL,
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
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1)
    )
AS 
    BEGIN  
        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            ) ;
    
        INSERT  INTO saIncoterm
                ( co_Incoterm, Incoterm_des, secuencia, maritimo, aereo, terrestre, descrip_detallada, campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8,
                  co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, trasnfe )
        OUTPUT  Inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCo_Incoterm, @sIncoterm_Des, @deSecuencia, @bMaritimo, @bAereo, @bTerrestre, @sdescrip_detallada, @sCampo1, @sCampo2, @sCampo3, @sCampo4, @sCampo5,
                  @sCampo6, @sCampo7, @sCampo8, @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sCo_Us_In, @sCo_Sucu_In, GETDATE(),
                  @sRevisado, @sTrasnfe )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saIncoterm', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
```
