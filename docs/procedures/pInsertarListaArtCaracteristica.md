# SP: pInsertarListaArtCaracteristica
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saArtCaracteristica`](../tables/saArtCaracteristica.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pInsertarListaArtCaracteristica]
    (
		@sCo_art			CHAR(30) ,
		@sCo_lin01			CHAR(6)		= NULL,
		@sCo_lin02			CHAR(6)		= NULL ,
		@sCo_lin03			CHAR(6)		= NULL ,
		@sCo_lin04			CHAR(6)		= NULL ,
		@sCo_lin05			CHAR(6)		= NULL ,
	    @sCampo1			VARCHAR(60) = NULL ,
		@sCampo2			VARCHAR(60) = NULL ,
		@sCampo3			VARCHAR(60) = NULL ,
		@sCampo4			VARCHAR(60) = NULL ,
		@sCampo5			VARCHAR(60) = NULL ,
		@sCampo6			VARCHAR(60) = NULL ,
		@sCampo7			VARCHAR(60) = NULL ,
		@sCampo8			VARCHAR(60) = NULL ,
		@sCo_Us_In			CHAR(6) ,
		@sCo_Sucu_In		CHAR(6) ,
		@sCo_Us_Mo			CHAR(6) ,
		@sCo_Sucu_Mo		CHAR(6) ,
		@sMaquina			VARCHAR(60) = NULL,
		--@bSin_der_cre_fis BIT
		@iCredito_Fiscal	INT			= NULL
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

	DECLARE @bArt33 BIT

	IF (@iCredito_Fiscal <> 0)
		SET @bArt33 = 0
	ELSE
		SET @bArt33 = 1
    
    IF NOT EXISTS (SELECT co_art from saArtCaracteristica where co_art = @sCo_art)
	BEGIN
		
		INSERT INTO saArtCaracteristica
           (
			   
			   Co_Art,co_lin01, co_lin02, co_lin03, co_lin04, co_lin05
			   ,campo1 ,campo2 ,campo3 
			   ,campo4 ,campo5 ,campo6 ,campo7
			   ,campo8 ,co_us_in ,co_sucu_in ,fe_us_in
			   ,co_us_mo ,co_sucu_mo ,fe_us_mo ,revisado, sin_der_cre_fis, credito_fiscal
			   

           )
           
            OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
     VALUES
           (
				@sco_Art, @sCo_lin01, @sCo_lin02, @sCo_lin03, @sCo_lin04, @sCo_lin05, @sCampo1, @sCampo2,  @sCampo3, @sCampo4, @sCampo5, @sCampo6,
				@sCampo7, @sCampo8, @sCo_Us_In, @sCo_Sucu_In, GETDATE(),
				@sCo_Us_Mo, @sCo_Sucu_Mo, GETDATE(), NULL, @bArt33, @iCredito_Fiscal
           )
           
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saArtCaracteristica', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sCo_art
		
        SELEC
```
